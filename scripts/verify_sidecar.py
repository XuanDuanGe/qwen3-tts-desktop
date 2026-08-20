#!/usr/bin/env python3
"""Verify a built Qwen3-TTS sidecar can complete the NDJSON startup handshake."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENGINE = ROOT / "desktop" / "build-resources" / "engine" / "qwen-tts-engine.exe"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", type=Path, default=DEFAULT_ENGINE)
    args = parser.parse_args()
    engine = args.engine.resolve()
    if not engine.is_file():
        raise SystemExit(f"Sidecar executable is missing: {engine}")

    with tempfile.TemporaryDirectory(prefix="qwen-tts-engine-verify-") as temp_dir:
        temp = Path(temp_dir)
        request = {
            "protocolVersion": 1,
            "type": "request",
            "requestId": "verify-hello",
            "method": "engine.hello",
            "params": {},
        }
        completed = subprocess.run(
            [
                str(engine),
                "--app-data-dir",
                str(temp / "app-data"),
                "--cache-dir",
                str(temp / "cache"),
            ],
            input=f"{json.dumps(request)}\n",
            text=True,
            capture_output=True,
            timeout=120,
            check=False,
        )
    if completed.returncode != 0:
        raise SystemExit(
            f"Sidecar exited with {completed.returncode}: {completed.stderr.strip()}"
        )
    try:
        response = json.loads(completed.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as error:
        raise SystemExit(f"Invalid sidecar output: {completed.stdout.strip()}") from error
    if not response.get("ok") or response.get("result", {}).get("engine") != "qwen-tts-engine":
        raise SystemExit(f"Unexpected sidecar response: {response}")
    print(f"Verified sidecar: {engine}")


if __name__ == "__main__":
    main()
