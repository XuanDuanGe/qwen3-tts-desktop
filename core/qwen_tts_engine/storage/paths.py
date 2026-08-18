import os
from pathlib import Path


class RuntimePaths:
    def __init__(self, app_data_dir, cache_dir):
        self.app_data = Path(app_data_dir).expanduser().resolve()
        self.cache = Path(cache_dir).expanduser().resolve()
        self.models = self.app_data / "models"
        self.outputs = self.app_data / "outputs"
        self.temp = self.app_data / "temp"
        self.references = self.temp / "references"
        self.logs = self.app_data / "logs"

    def prepare(self):
        for path in (
            self.models,
            self.outputs,
            self.temp,
            self.references,
            self.logs,
            self.cache,
        ):
            path.mkdir(parents=True, exist_ok=True)
        os.environ["HF_HOME"] = str(self.cache / "huggingface")
        os.environ["MODELSCOPE_CACHE"] = str(self.cache / "modelscope")
        os.environ["TORCH_HOME"] = str(self.cache / "torch")
        os.environ["TRITON_CACHE_DIR"] = str(self.cache / "triton")

    def model_path(self, model_id):
        return self.models / model_id

    def reference_path(self, reference_id):
        path = (self.references / reference_id).resolve()
        if self.references not in path.parents:
            raise ValueError("invalid reference path")
        return path

    def artifact_path(self, artifact_id):
        path = (self.outputs / f"{artifact_id}.wav").resolve()
        if self.outputs not in path.parents:
            raise ValueError("invalid artifact path")
        return path
