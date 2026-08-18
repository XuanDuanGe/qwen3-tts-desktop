import os
import shutil
import threading
import uuid
from pathlib import Path


class UnknownModelError(Exception):
    pass


class ModelInstallError(Exception):
    pass


SPEAKERS = [
    "Vivian",
    "Serena",
    "Uncle_Fu",
    "Dylan",
    "Eric",
    "Ryan",
    "Aiden",
    "Ono_Anna",
    "Sohee",
]

LANGUAGES = [
    "Auto",
    "Chinese",
    "English",
    "Japanese",
    "Korean",
    "German",
    "French",
    "Russian",
    "Portuguese",
    "Spanish",
    "Italian",
]

CUSTOM_VOICE_CAPABILITIES = {
    "speakers": SPEAKERS,
    "languages": LANGUAGES,
}

MODEL_REGISTRY = {
    "qwen3-tts-12hz-1.7b-base": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "modelScopeId": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "capabilities": ["voice_clone"],
    },
    "qwen3-tts-12hz-0.6b-base": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        "modelScopeId": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        "capabilities": ["voice_clone"],
    },
    "qwen3-tts-12hz-1.7b-customvoice": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "modelScopeId": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "capabilities": ["custom_voice"],
        "voice": CUSTOM_VOICE_CAPABILITIES,
    },
    "qwen3-tts-12hz-0.6b-customvoice": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        "modelScopeId": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        "capabilities": ["custom_voice"],
        "voice": CUSTOM_VOICE_CAPABILITIES,
    },
    "qwen3-tts-12hz-1.7b-voicedesign": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        "modelScopeId": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        "capabilities": ["voice_design"],
    },
}

_INSTALL_LOCKS = {}
_INSTALL_LOCKS_GUARD = threading.Lock()


def install_model(paths, model_id, proxy=None):
    model = get_model(model_id)
    if model is None:
        raise UnknownModelError("unknown model")

    lock = _get_install_lock(model_id)
    with lock:
        target = paths.model_path(model_id)
        if is_model_complete(target):
            return {"modelId": model_id, "installed": True}

        staging_root = paths.models / ".staging"
        staging = staging_root / str(uuid.uuid4())
        staging_root.mkdir(parents=True, exist_ok=True)
        try:
            _download_model(model, staging, paths, proxy)
            if not is_model_complete(staging):
                raise ModelInstallError("downloaded model is incomplete")
            if target.exists():
                shutil.rmtree(target)
            target.parent.mkdir(parents=True, exist_ok=True)
            staging.replace(target)
        except Exception:
            shutil.rmtree(staging, ignore_errors=True)
            raise
    return {"modelId": model_id, "installed": True}


def _get_install_lock(model_id):
    with _INSTALL_LOCKS_GUARD:
        return _INSTALL_LOCKS.setdefault(model_id, threading.Lock())


def _download_model(model, staging, paths, proxy=None):
    try:
        from modelscope import snapshot_download as modelscope_snapshot_download
    except Exception as exc:
        raise ModelInstallError(
            f"ModelScope is unavailable: {type(exc).__name__}: {exc}"
        ) from exc

    previous = {
        key: os.environ.get(key)
        for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY")
    }
    if proxy:
        for key in previous:
            os.environ[key] = proxy
    try:
        try:
            snapshot = _snapshot_download(
                modelscope_snapshot_download,
                model["modelScopeId"],
                local_files_only=True,
            )
        except Exception:
            try:
                snapshot = _snapshot_download(
                    modelscope_snapshot_download,
                    model["modelScopeId"],
                    local_files_only=False,
                )
            except Exception as exc:
                raise ModelInstallError(f"ModelScope: {exc}") from exc
        _copy_snapshot(snapshot, staging)
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _snapshot_download(download, repo_id, local_files_only):
    return download(
        repo_id=repo_id,
        repo_type="model",
        local_files_only=local_files_only,
    )


def _copy_snapshot(snapshot, staging):
    source = Path(snapshot)
    if not source.is_dir():
        raise ModelInstallError("ModelScope returned an invalid snapshot path")
    shutil.copytree(source, staging, dirs_exist_ok=True)


def is_model_complete(path):
    path = Path(path)
    if not path.is_dir() or not (path / "config.json").is_file():
        return False
    tokenizer = path / "speech_tokenizer"
    if not tokenizer.is_dir():
        return False
    return any(path.glob("*.safetensors")) or any(path.glob("*.bin"))


def list_models(paths):
    return [
        {
            "modelId": model_id,
            "repoId": spec["repoId"],
            "capabilities": spec["capabilities"],
            "installed": is_model_complete(paths.model_path(model_id)),
        }
        for model_id, spec in MODEL_REGISTRY.items()
    ]


def get_model(model_id):
    return MODEL_REGISTRY.get(model_id)


def get_capabilities(model_id):
    model = get_model(model_id)
    if model is None:
        return None
    return model.get("voice", {"speakers": [], "languages": []})
