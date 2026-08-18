import gc
import sys


class QwenRuntime:
    def __init__(self, device="auto", dtype="bfloat16"):
        self.device = device
        self.dtype = dtype
        self.model = None
        self.model_id = None

    def is_loaded(self, model_id):
        return self.model_id == model_id and self.model is not None

    def load(self, model_id, model_path):
        if self.is_loaded(model_id):
            return False
        self.unload()
        try:
            import torch
            from qwen_tts import Qwen3TTSModel
        except ImportError as exc:
            raise RuntimeError("qwen-tts runtime dependencies are not installed") from exc
        if not model_path.is_dir():
            raise FileNotFoundError(f"model is not installed: {model_id}")
        device = self.device
        dtype = self.dtype
        if device == "auto" and not torch.cuda.is_available():
            device = "cpu"
        if device == "cpu" and dtype == "bfloat16":
            dtype = "float32"
        print(
            f"[engine] runtime load model={model_id} device={device} dtype={dtype} cuda={torch.cuda.is_available()}",
            file=sys.stderr,
            flush=True,
        )
        load_kwargs = {"device_map": device}
        if dtype != "auto":
            load_kwargs["dtype"] = getattr(torch, dtype)
        self.model = Qwen3TTSModel.from_pretrained(str(model_path), **load_kwargs)
        self.model_id = model_id
        return True

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
