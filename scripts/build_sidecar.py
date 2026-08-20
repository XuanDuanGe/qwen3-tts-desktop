#!/usr/bin/env python3
"""Build Qwen3-TTS Python sidecar for Windows Electron releases."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / "core"
ENTRYPOINT = ROOT / "scripts" / "sidecar_entry.py"
DEFAULT_DIST = ROOT / "desktop" / "build-resources" / "engine"
RUNTIME_PACKAGES = [
    "accelerate",
    "einops",
    "huggingface_hub",
    "librosa",
    "modelscope",
    "modelscope_hub",
    "numba",
    "onnxruntime",
    "qwen_tts",
    "safetensors",
    "sklearn",
    "soundfile",
    "sox",
    "soxr",
    "torch",
    "torchaudio",
    "transformers",
]


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print("+", subprocess.list2cmdline(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def remove(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def smoke_test(engine: Path, python: str) -> None:
    with tempfile.TemporaryDirectory(prefix="qwen-tts-engine-smoke-") as temp_dir:
        temp = Path(temp_dir)
        request = {
            "protocolVersion": 1,
            "type": "request",
            "requestId": "release-smoke",
            "method": "engine.hello",
            "params": {},
        }
        command = [
            str(engine),
            "--app-data-dir",
            str(temp / "app-data"),
            "--cache-dir",
            str(temp / "cache"),
        ]
        try:
            completed = subprocess.run(
                command,
                input=f"{json.dumps(request)}\n",
                text=True,
                capture_output=True,
                timeout=120,
                check=False,
            )
        except OSError as error:
            raise RuntimeError(f"Could not launch packaged engine: {error}") from error
        if completed.returncode != 0:
            raise RuntimeError(
                "Packaged engine smoke test failed "
                f"(exit {completed.returncode}): {completed.stderr.strip()}"
            )
        try:
            response = json.loads(completed.stdout.strip().splitlines()[-1])
        except (IndexError, json.JSONDecodeError) as error:
            raise RuntimeError(
                "Packaged engine did not return a valid NDJSON response: "
                f"{completed.stdout.strip()}\n{completed.stderr.strip()}"
            ) from error
        if not response.get("ok") or response.get("result", {}).get("engine") != "qwen-tts-engine":
            raise RuntimeError(f"Unexpected packaged engine response: {response}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--python", default=sys.executable, help="Python interpreter for PyInstaller")
    parser.add_argument("--output", type=Path, default=DEFAULT_DIST)
    parser.add_argument("--skip-smoke-test", action="store_true")
    args = parser.parse_args()

    if os.name != "nt":
        raise SystemExit("Windows is required to build the Windows sidecar.")
    python = str(Path(args.python).resolve())
    output = args.output.resolve()
    build_dir = ROOT / ".build" / "sidecar"
    spec_dir = build_dir / "spec"
    dist_dir = build_dir / "dist"
    work_dir = build_dir / "work"

    for path in (spec_dir, dist_dir, work_dir):
        remove(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    remove(output)

    command = [
        python,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onedir",
        "--name",
        "qwen-tts-engine",
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(spec_dir),
        "--collect-all",
        "qwen_tts",
        "--collect-all",
        "torch",
        "--collect-all",
        "torchaudio",
        "--collect-all",
        "transformers",
        "--collect-all",
        "modelscope",
        "--collect-all",
        "modelscope_hub",
        "--collect-all",
        "onnxruntime",
        "--collect-all",
        "soundfile",
        "--collect-all",
        "librosa",
        "--collect-all",
        "sox",
        "--collect-all",
        "soxr",
        "--collect-all",
        "numba",
        "--collect-all",
        "sklearn",
    ]
    for package in RUNTIME_PACKAGES:
        command.extend(["--hidden-import", package])
    command.append(str(ENTRYPOINT))
    run(command, cwd=CORE)

    built = dist_dir / "qwen-tts-engine"
    engine = built / "qwen-tts-engine.exe"
    if not engine.is_file():
        raise RuntimeError(f"PyInstaller did not produce {engine}")
    shutil.move(str(built), str(output))
    if not args.skip_smoke_test:
        smoke_test(output / "qwen-tts-engine.exe", python)
    print(f"Built sidecar: {output}", flush=True)


if __name__ == "__main__":
    main()
