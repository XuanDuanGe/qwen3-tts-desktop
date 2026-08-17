import json
import sys
from pathlib import Path

from .artifacts import ArtifactStore
from .jobs import JobQueue
from .models import get_model, list_models
from .paths import RuntimePaths
from .protocol import EngineError, error_response, event, require, response
from .references import ReferenceStore
from .runtime import QwenRuntime


class EngineServer:
    def __init__(self, app_data_dir, cache_dir, device="auto", dtype="bfloat16"):
        self.paths = RuntimePaths(app_data_dir, cache_dir)
        self.paths.prepare()
        self.runtime = QwenRuntime(device, dtype)
        self.artifacts = ArtifactStore(self.paths)
        self.references = ReferenceStore(self.paths)
        self.running = True
        self.queue = JobQueue(self._run_job, self._emit)

    def serve(self):
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                request = json.loads(line)
                result = self.handle(request)
                self._write(response(request.get("requestId"), result))
                if request.get("method") == "engine.shutdown":
                    return
            except EngineError as exc:
                self._write(error_response(request.get("requestId"), exc))
            except Exception as exc:
                self._log(exc)
                self._write(error_response(request.get("requestId"), EngineError("internal_error", str(exc))))
        self.close()

    def handle(self, request):
        if request.get("protocolVersion") != 1:
            raise EngineError("invalid_request", "unsupported protocol version")
        method = request.get("method")
        params = request.get("params") or {}
        if method == "engine.hello":
            return {"engine": "qwen-tts-engine", "protocolVersion": 1}
        if method == "engine.health":
            return {"status": "ready" if self.running else "stopped"}
        if method == "engine.shutdown":
            self.close()
            return {"status": "stopped"}
        if method == "models.list":
            return {"models": list_models(self.paths)}
        if method == "jobs.submit":
            return self._submit(params)
        if method == "jobs.get":
            try:
                return self.queue.get(require(params.get("jobId"), "jobId"))
            except ValueError as exc:
                raise EngineError("job_not_found", str(exc)) from exc
        if method == "jobs.cancel":
            try:
                return self.queue.cancel(require(params.get("jobId"), "jobId"))
            except ValueError as exc:
                raise EngineError("job_not_found", str(exc)) from exc
        if method == "artifacts.get":
            return self.artifacts.get(require(params.get("artifactId"), "artifactId"))
        if method == "artifacts.delete":
            self.artifacts.delete(require(params.get("artifactId"), "artifactId"))
            return {"deleted": True}
        if method == "references.put":
            return self.references.put(Path(require(params.get("sourcePath"), "sourcePath")))
        if method == "references.delete":
            self.references.delete(require(params.get("referenceAudioId"), "referenceAudioId"))
            return {"deleted": True}
        raise EngineError("invalid_request", f"unknown method: {method}")

    def close(self):
        if self.running:
            self.running = False
            self.queue.close()
            self.runtime.unload()

    def _submit(self, params):
        kind = require(params.get("kind"), "kind")
        model_id = require(params.get("modelId"), "modelId")
        text = require(params.get("text"), "text")
        model = get_model(model_id)
        if model is None:
            raise EngineError("model_not_found", "unknown model")
        if kind not in model["capabilities"]:
            raise EngineError("capability_mismatch", "model does not support this job")
        if kind == "voice_design":
            require(params.get("instruct"), "instruct")
        if kind == "voice_clone":
            reference_id = require(params.get("referenceAudioId"), "referenceAudioId")
            self.references.resolve(reference_id)
        return self.queue.submit({**params, "text": text})

    def _run_job(self, params, item):
        model_id = params["modelId"]
        self.runtime.load(model_id, self.paths.model_path(model_id))
        if item["cancelled"]:
            raise RuntimeError("cancelled")
        run_params = dict(params)
        if params["kind"] == "voice_clone":
            run_params["referenceAudioPath"] = str(self.references.resolve(params["referenceAudioId"]))
        wavs = self.runtime.generate(params["kind"], run_params)
        artifact = self.artifacts.write(wavs, 24000)
        self._emit("artifact.created", artifact)
        return artifact

    def _emit(self, name, payload):
        self._write(event(name, payload))

    def _write(self, message):
        sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    def _log(self, error):
        print(f"{type(error).__name__}: {error}", file=sys.stderr, flush=True)
