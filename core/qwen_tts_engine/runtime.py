import gc


class QwenRuntime:
    def __init__(self, device="auto", dtype="bfloat16"):
        self.device = device
        self.dtype = dtype
        self.model = None
        self.model_id = None

    def load(self, model_id, model_path):
        if self.model_id == model_id and self.model is not None:
            return
        self.unload()
        try:
            import torch
            from qwen_tts import Qwen3TTSModel
        except ImportError as exc:
            raise RuntimeError("qwen-tts runtime dependencies are not installed") from exc
        if not model_path.is_dir():
            raise FileNotFoundError(f"model is not installed: {model_id}")
        load_kwargs = {"device_map": self.device}
        if self.dtype != "auto":
            load_kwargs["dtype"] = getattr(torch, self.dtype)
        self.model = Qwen3TTSModel.from_pretrained(str(model_path), **load_kwargs)
        self.model_id = model_id

    def unload(self):
        self.model = None
        self.model_id = None
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    def generate(self, kind, params):
        if self.model is None:
            raise RuntimeError("model is not loaded")
        if kind == "custom_voice":
            return self.model.generate_custom_voice(
                text=params["text"],
                speaker=params.get("speaker"),
                language=params.get("language", "Auto"),
                instruct=params.get("instruct"),
                **params.get("sampling", {}),
            )
        if kind == "voice_design":
            return self.model.generate_voice_design(
                text=params["text"],
                instruct=params["instruct"],
                language=params.get("language", "Auto"),
                **params.get("sampling", {}),
            )
        if kind == "voice_clone":
            return self.model.generate_voice_clone(
                text=params["text"],
                ref_audio=params["referenceAudioPath"],
                ref_text=params.get("referenceText"),
                language=params.get("language", "Auto"),
                x_vector_only_mode=not bool(params.get("referenceText")),
                **params.get("sampling", {}),
            )
        raise ValueError(f"unsupported job kind: {kind}")
