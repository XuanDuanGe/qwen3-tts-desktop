MODEL_REGISTRY = {
    "qwen3-tts-12hz-1.7b-base": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "capabilities": ["voice_clone"],
    },
    "qwen3-tts-12hz-0.6b-base": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        "capabilities": ["voice_clone"],
    },
    "qwen3-tts-12hz-1.7b-customvoice": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "capabilities": ["custom_voice"],
    },
    "qwen3-tts-12hz-0.6b-customvoice": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
        "capabilities": ["custom_voice"],
    },
    "qwen3-tts-12hz-1.7b-voicedesign": {
        "repoId": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        "capabilities": ["voice_design"],
    },
}


def list_models(paths):
    return [
        {
            "modelId": model_id,
            "repoId": spec["repoId"],
            "capabilities": spec["capabilities"],
            "installed": paths.model_path(model_id).is_dir(),
        }
        for model_id, spec in MODEL_REGISTRY.items()
    ]


def get_model(model_id):
    return MODEL_REGISTRY.get(model_id)
