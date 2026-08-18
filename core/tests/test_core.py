from pathlib import Path
import threading

import pytest

from qwen_tts_engine.jobs import JobQueue
from qwen_tts_engine.models import (
    UnknownModelError,
    get_capabilities,
    install_model,
    list_models,
)
from qwen_tts_engine.paths import RuntimePaths
from qwen_tts_engine.protocol import EngineError


CUSTOM_VOICE_MODEL = "qwen3-tts-12hz-1.7b-customvoice"


def test_job_queue_reports_stages():
    events = []
    done = threading.Event()

    def handler(params, item, update):
        update("running", 0.5, "generating", "正在生成语音")
        done.set()
        return {"artifactId": "test"}

    queue = JobQueue(handler, lambda name, payload: events.append(payload.copy()))
    try:
        job = queue.submit({})
        assert done.wait(1)
        queue.worker.join(1)
        assert [event["stage"] for event in events] == [
            "waiting",
            "loading_model",
            "generating",
            "completed",
        ]
        assert queue.get(job["jobId"])["message"] == "生成完成"
    finally:
        queue.close()


def test_paths(tmp_path):
    paths = RuntimePaths(tmp_path / "app", tmp_path / "cache")
    paths.prepare()
    assert paths.models.is_dir()
    assert paths.references.is_dir()
    assert len(list_models(paths)) == 5


def test_custom_voice_capabilities():
    capabilities = get_capabilities(CUSTOM_VOICE_MODEL)
    assert "Vivian" in capabilities["speakers"]
    assert "Chinese" in capabilities["languages"]
    assert "Auto" in capabilities["languages"]


def test_install_model_rejects_unknown_model(tmp_path):
    paths = RuntimePaths(tmp_path / "app", tmp_path / "cache")
    paths.prepare()
    with pytest.raises(UnknownModelError, match="unknown model"):
        install_model(paths, "unknown")

    from qwen_tts_engine.server import EngineServer

    server = EngineServer(tmp_path / "app", tmp_path / "cache")
    try:
        with pytest.raises(EngineError, match="unsupported speaker"):
            server._submit(
                {
                    "kind": "custom_voice",
                    "modelId": CUSTOM_VOICE_MODEL,
                    "text": "hello",
                    "speaker": "unknown",
                    "language": "English",
                }
            )
    finally:
        server.close()
