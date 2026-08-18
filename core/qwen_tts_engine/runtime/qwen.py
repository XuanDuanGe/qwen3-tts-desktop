import gc
import importlib
import os
import sys
import threading
import time
from contextlib import redirect_stdout


def _memory_snapshot():
    snapshot = {"rss_mib": None, "available_mib": None}
    try:
        if os.name != "nt":
            return snapshot
        import ctypes
        from ctypes import wintypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", wintypes.DWORD),
                ("dwMemoryLoad", wintypes.DWORD),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        status = MEMORYSTATUSEX()
        status.dwLength = ctypes.sizeof(status)
        counters = PROCESS_MEMORY_COUNTERS()
        counters.cb = ctypes.sizeof(counters)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
        ctypes.windll.psapi.GetProcessMemoryInfo(
            ctypes.windll.kernel32.GetCurrentProcess(),
            ctypes.byref(counters),
            counters.cb,
        )
        snapshot["rss_mib"] = round(counters.WorkingSetSize / 1024 / 1024)
        snapshot["available_mib"] = round(status.ullAvailPhys / 1024 / 1024)
    except Exception:
        pass
    return snapshot


class QwenRuntime:
    _dependency_lock = threading.Lock()
    _dependencies = None

    def __init__(self, device="auto", dtype="bfloat16"):
        self.device = device
        self.dtype = dtype
        self.model = None
        self.model_id = None

    def is_loaded(self, model_id):
        return self.model_id == model_id and self.model is not None

    @staticmethod
    def _write_log(message):
        print(f"[engine] {message}", file=sys.stderr, flush=True)

    def _log(self, message):
        self._write_log(message)

    @classmethod
    def warmup_dependencies(cls):
        dependencies = cls._dependencies
        if dependencies is not None:
            return dependencies
        with cls._dependency_lock:
            dependencies = cls._dependencies
            if dependencies is not None:
                return dependencies
            started = time.monotonic()
            cls._write_log(
                f"runtime warmup started rss={_memory_snapshot()['rss_mib']} available={_memory_snapshot()['available_mib']}"
            )
            try:
                with redirect_stdout(sys.stderr):
                    torch = importlib.import_module("torch")
                    qwen_tts = importlib.import_module("qwen_tts")
            except ImportError as exc:
                raise RuntimeError("qwen-tts runtime dependencies are not installed") from exc
            dependencies = {
                "torch": torch,
                "Qwen3TTSModel": qwen_tts.Qwen3TTSModel,
            }
            cls._dependencies = dependencies
            cls._write_log(
                f"runtime warmup completed elapsed_ms={int((time.monotonic() - started) * 1000)} torch={torch.__version__} cuda={torch.cuda.is_available()} rss={_memory_snapshot()['rss_mib']} available={_memory_snapshot()['available_mib']}"
            )
            return dependencies

    def load(self, model_id, model_path):
        if self.is_loaded(model_id):
            return False
        self.unload()
        self._log(
            f"runtime preflight model={model_id} rss={_memory_snapshot()['rss_mib']} available={_memory_snapshot()['available_mib']}"
        )
        dependencies = self.warmup_dependencies()
        torch = dependencies["torch"]
        Qwen3TTSModel = dependencies["Qwen3TTSModel"]
        self._log(
            f"runtime imports ready model={model_id} torch={torch.__version__} cuda={torch.cuda.is_available()} rss={_memory_snapshot()['rss_mib']} available={_memory_snapshot()['available_mib']}"
        )
        if not model_path.is_dir():
            raise FileNotFoundError(f"model is not installed: {model_id}")
        device = self.device
        dtype = self.dtype
        if device == "auto" and not torch.cuda.is_available():
            device = "cpu"
        if device == "cpu" and dtype == "bfloat16":
            dtype = "float32"
        self._log(
            f"runtime from_pretrained started model={model_id} device_requested={self.device} device_effective={device} dtype_requested={self.dtype} dtype_effective={dtype}"
        )
        load_kwargs = {"device_map": device}
        if dtype != "auto":
            load_kwargs["dtype"] = getattr(torch, dtype)
        started = time.monotonic()
        try:
            with redirect_stdout(sys.stderr):
                self.model = Qwen3TTSModel.from_pretrained(str(model_path), **load_kwargs)
        except Exception as exc:
            self._log(
                f"runtime from_pretrained failed model={model_id} type={type(exc).__name__} elapsed_ms={int((time.monotonic() - started) * 1000)}"
            )
            raise
        self.model_id = model_id
        self._log(
            f"runtime from_pretrained completed model={model_id} elapsed_ms={int((time.monotonic() - started) * 1000)} rss={_memory_snapshot()['rss_mib']} available={_memory_snapshot()['available_mib']}"
        )
        return True

    def unload(self):
        self.model = None
        self.model_id = None
        gc.collect()
        dependencies = self._dependencies
        if dependencies is None:
            return
        torch = dependencies["torch"]
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def generate(self, kind, params):
        if self.model is None:
            raise RuntimeError("model is not loaded")
        if kind == "custom_voice":
            with redirect_stdout(sys.stderr):
                return self.model.generate_custom_voice(
                    text=params["text"],
                    speaker=params.get("speaker"),
                    language=params.get("language", "Auto"),
                    instruct=params.get("instruct"),
                    **params.get("sampling", {}),
                )
        if kind == "voice_design":
            with redirect_stdout(sys.stderr):
                return self.model.generate_voice_design(
                    text=params["text"],
                    instruct=params["instruct"],
                    language=params.get("language", "Auto"),
                    **params.get("sampling", {}),
                )
        if kind == "voice_clone":
            with redirect_stdout(sys.stderr):
                return self.model.generate_voice_clone(
                    text=params["text"],
                    ref_audio=params["referenceAudioPath"],
                    ref_text=params.get("referenceText"),
                    language=params.get("language", "Auto"),
                    x_vector_only_mode=not bool(params.get("referenceText")),
                    **params.get("sampling", {}),
                )
        raise ValueError(f"unsupported job kind: {kind}")
