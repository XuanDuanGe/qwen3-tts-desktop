import json
import sys
import threading
import time
from pathlib import Path

from ..jobs import JobQueue
from ..models import (
    UnknownModelError,
    get_capabilities,
    get_model,
    install_model,
    list_models,
)
from ..runtime import QwenRuntime
from ..storage import ArtifactStore, ReferenceStore, RuntimePaths
from .protocol import EngineError, error_response, event, require, require_string, response


class EngineServer:
    def __init__(self, app_data_dir, cache_dir, device="auto", dtype="bfloat16"):
        self.paths = RuntimePaths(app_data_dir, cache_dir)
        self.paths.prepare()
        self.runtime = QwenRuntime(device, dtype)
        self.artifacts = ArtifactStore(self.paths)
        self.references = ReferenceStore(self.paths)
        self.running = True
        self._stdout_lock = threading.Lock()
        self.queue = JobQueue(self._run_job, self._emit)

    def serve(self):
        for line in sys.stdin:
            if not line.strip():
                continue
            request = {}
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
                self._write(
                    error_response(
                        request.get("requestId"),
                        EngineError("internal_error", str(exc)),
                    )
                )
        self.close()

    def handle(self, request):
        if not isinstance(request, dict) or request.get("protocolVersion") != 1:
            raise EngineError("invalid_request", "unsupported protocol version")
        method = request.get("method")
        params = request.get("params") or {}
        if not isinstance(params, dict):
            raise EngineError("invalid_request", "params must be an object")
        if method == "engine.hello":
            return {"engine": "qwen-tts-engine", "protocolVersion": 1}
        if method == "engine.health":
            return {"status": "ready" if self.running else "stopped"}
        if method == "engine.shutdown":
            self.close()
            return {"status": "stopped"}
        if method == "models.list":
            return {"models": list_models(self.paths)}
        if method == "models.capabilities":
            return self._capabilities(params)
        if method == "models.install":
            return self._install_model(params)
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
        if not self.running:
            return
        self.running = False
        if self.queue.close():
            self.runtime.unload()
        else:
            self._log_message("job worker did not stop before shutdown timeout")

    def _submit(self, params):
        kind = require_string(params.get("kind"), "kind", 64)
        model_id = require_string(params.get("modelId"), "modelId", 128)
        text = require_string(params.get("text"), "text", 20_000)
        model = get_model(model_id)
        if model is None:
            raise EngineError("model_not_found", "unknown model")
        if kind not in model["capabilities"]:
            raise EngineError("capability_mismatch", "model does not support this job")
        if kind == "custom_voice":
            capabilities = model["voice"]
            speaker = params.get("speaker")
            language = params.get("language", "Auto")
            if speaker not in capabilities["speakers"]:
                raise EngineError("invalid_speaker", "unsupported speaker")
            if language not in capabilities["languages"]:
                raise EngineError("invalid_language", "unsupported language")
        if kind == "voice_design":
            require_string(params.get("instruct"), "instruct", 4_000)
        if kind == "voice_clone":
            reference_id = require_string(params.get("referenceAudioId"), "referenceAudioId", 128)
            self.references.resolve(reference_id)
        sampling = params.get("sampling")
        if sampling is not None and not isinstance(sampling, dict):
            raise EngineError("invalid_request", "sampling must be an object")
        return self.queue.submit({**params, "text": text})

    def _capabilities(self, params):
        model_id = require_string(params.get("modelId"), "modelId", 128)
        capabilities = get_capabilities(model_id)
        if capabilities is None:
            raise EngineError("model_not_found", "unknown model")
        return capabilities

    def _install_model(self, params):
        model_id = require_string(params.get("modelId"), "modelId", 128)
        proxy = params.get("proxy")
        if proxy is not None and not isinstance(proxy, str):
            raise EngineError("invalid_request", "proxy must be a string")
        try:
            return install_model(self.paths, model_id, proxy or None)
        except UnknownModelError as exc:
            raise EngineError("model_not_found", str(exc)) from exc
        except Exception as exc:
            raise EngineError("model_install_failed", str(exc)) from exc

    def _run_job(self, params, item, update):
        if item["cancelled"]:
            raise RuntimeError("cancelled")
        model_id = params["modelId"]
        started = time.monotonic()
        self._log_message(f"job started kind={params['kind']} text_length={len(params['text'])}")
        load_started = time.monotonic()
        if self.runtime.is_loaded(model_id):
            self._log_message(f"reusing loaded model model={model_id}")
        else:
            update("preparing", 0.1, "loading_model", "正在加载模型")
            self._log_message(f"loading model started model={model_id}")
            stop_timer = threading.Event()

            def report_loading_time():
                elapsed = 0
                while not stop_timer.wait(10):
                    elapsed += 10
                    self._log_message(f"loading model waiting elapsed_seconds={elapsed}")

            timer = threading.Thread(target=report_loading_time, daemon=True)
            timer.start()
            try:
                self.runtime.load(model_id, self.paths.model_path(model_id))
            except Exception as exc:
                self._log_message(f"loading model failed type={type(exc).__name__} error={exc}")
                raise
            finally:
                stop_timer.set()
                timer.join(timeout=1)
            self._log_message(
                f"loading model completed duration_ms={int((time.monotonic() - load_started) * 1000)}"
            )
        if item["cancelled"]:
            raise RuntimeError("cancelled")
        update("running", 0.25, "generating", "正在生成语音")
        run_params = dict(params)
        if params["kind"] == "voice_clone":
            run_params["referenceAudioPath"] = str(
                self.references.resolve(params["referenceAudioId"])
            )
        texts = [params["text"]]
        if params.get("splitByLine"):
            texts = [line.strip() for line in params["text"].splitlines() if line.strip()]
            if not texts:
                raise ValueError("text must contain a non-empty line")
        wavs = []
        sample_rate = None
        total = len(texts)
        for index, text in enumerate(texts, start=1):
            if item["cancelled"]:
                raise RuntimeError("cancelled")
            progress = 0.25 + (0.6 * (index - 1) / total)
            update(
                "running",
                progress,
                "generating",
                f"正在生成第 {index}/{total} 段",
            )
            run_params["text"] = text
            segment_started = time.monotonic()
            segment_wavs, sample_rate = self.runtime.generate(params["kind"], run_params)
            wavs.extend(segment_wavs)
            self._log_message(
                f"segment completed index={index} total={total} duration_ms={int((time.monotonic() - segment_started) * 1000)}"
            )
        if params.get("splitByLine") and len(wavs) > 1:
            import numpy as np

            update("running", 0.88, "merging", "正在合并音频片段")
            wavs = [
                np.concatenate(
                    [
                        wave.detach().cpu().numpy()
                        if hasattr(wave, "detach")
                        else np.asarray(wave)
                        for wave in wavs
                    ],
                    axis=-1,
                )
            ]
        if item["cancelled"]:
            raise RuntimeError("cancelled")
        update("running", 0.95, "saving", "正在保存音频")
        if sample_rate is None:
            raise RuntimeError("model returned no sample rate")
        artifact = self.artifacts.write(wavs, sample_rate)
        self._log_message(
            f"artifact created mime_type={artifact['mimeType']} sample_rate={sample_rate}"
        )
        self._emit("artifact.created", artifact)
        self._log_message(
            f"job completed duration_ms={int((time.monotonic() - started) * 1000)}"
        )
        return artifact

    def _emit(self, name, payload):
        self._write(event(name, payload))

    def _write(self, message):
        line = json.dumps(message, ensure_ascii=False) + "\n"
        with self._stdout_lock:
            sys.stdout.write(line)
            sys.stdout.flush()

    def _log(self, error):
        self._log_message(f"request failed type={type(error).__name__} error={error}")

    def _log_message(self, message):
        print(f"[engine] {message}", file=sys.stderr, flush=True)
