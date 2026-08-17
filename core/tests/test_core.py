from pathlib import Path

from qwen_tts_engine.models import list_models
from qwen_tts_engine.paths import RuntimePaths


def test_paths(tmp_path):
    paths = RuntimePaths(tmp_path / "app", tmp_path / "cache")
    paths.prepare()
    assert paths.models.is_dir()
    assert paths.references.is_dir()
    assert len(list_models(paths)) == 5
