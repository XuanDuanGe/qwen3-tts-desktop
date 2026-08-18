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
from qwen_tts_engine.runtime import QwenRuntime


CUSTOM_VOICE_MODEL = "qwen3-tts-12hz-1.7b-customvoice"


class _DummyTorch:
    __version__ = "test"
    float32 = object()

    class _Cuda:
        @staticmethod
        def is_available():
            return False

        @staticmethod
        def empty_cache():
            return None

    cuda = _Cuda()


class _DummyModelClass:
    calls = []

    @classmethod
    def from_pretrained(cls, model_path, **kwargs):
        cls.calls.append((model_path, kwargs))
        return object()


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


def test_runtime_warmup_caches_dependencies_and_uses_stderr(monkeypatch, capsys):
    QwenRuntime._dependencies = None
    imports = []

    def fake_import_module(name):
        imports.append(name)
        print(f"importing {name}")
        if name == "torch":
            return _DummyTorch
        if name == "qwen_tts":
            class _DummyQwenModule:
                Qwen3TTSModel = _DummyModelClass

            return _DummyQwenModule
        raise AssertionError(f"unexpected import: {name}")

    monkeypatch.setattr("qwen_tts_engine.runtime.importlib.import_module", fake_import_module)

    dependencies = QwenRuntime.warmup_dependencies()
    captured = capsys.readouterr()

    assert captured.out == ""
    assert "runtime warmup started" in captured.err
    assert "runtime warmup completed" in captured.err
    assert "importing torch" in captured.err
    assert "importing qwen_tts" in captured.err
    assert imports == ["torch", "qwen_tts"]
    assert dependencies["torch"] is _DummyTorch
    assert dependencies["Qwen3TTSModel"] is _DummyModelClass

    again = QwenRuntime.warmup_dependencies()
    assert again is dependencies
    assert imports == ["torch", "qwen_tts"]


def test_runtime_load_reuses_warmed_dependencies(monkeypatch, tmp_path):
    QwenRuntime._dependencies = {
        "torch": _DummyTorch,
        "Qwen3TTSModel": _DummyModelClass,
    }
    _DummyModelClass.calls = []

    monkeypatch.setattr(QwenRuntime, "warmup_dependencies", classmethod(lambda cls: QwenRuntime._dependencies))

    runtime = QwenRuntime(device="cpu", dtype="float32")
    model_dir = tmp_path / "model"
    model_dir.mkdir()
    (model_dir / "config.json").write_text("{}", encoding="utf-8")

    loaded = runtime.load("demo-model", model_dir)

    assert loaded is True
    assert runtime.model is not None
    assert runtime.model_id == "demo-model"
    assert _DummyModelClass.calls == [
        (str(model_dir), {"device_map": "cpu", "dtype": _DummyTorch.float32})
    ]


def test_main_warms_dependencies_before_server(monkeypatch, tmp_path):
    from types import SimpleNamespace
    from qwen_tts_engine import __main__ as entrypoint

    calls = []

    monkeypatch.setattr(
        entrypoint.argparse.ArgumentParser,
        "parse_args",
        lambda self: SimpleNamespace(
            app_data_dir=str(tmp_path / "app"),
            cache_dir=str(tmp_path / "cache"),
            device="cpu",
            dtype="float32",
        ),
    )
    monkeypatch.setattr(
        entrypoint.QwenRuntime,
        "warmup_dependencies",
        classmethod(lambda cls: calls.append("warmup")),
    )

    class DummyServer:
        def __init__(self, app_data_dir, cache_dir, device, dtype):
            calls.append(("server", app_data_dir, cache_dir, device, dtype))

        def serve(self):
            calls.append("serve")

    monkeypatch.setattr(entrypoint, "EngineServer", DummyServer)

    entrypoint.main()

    assert calls[0] == "warmup"
    assert calls[1] == (
        "server",
        tmp_path / "app",
        tmp_path / "cache",
        "cpu",
        "float32",
    )
    assert calls[2] == "serve"


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
