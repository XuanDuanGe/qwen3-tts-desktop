import argparse
from pathlib import Path

from .runtime import QwenRuntime
from .server import EngineServer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app-data-dir", required=True)
    parser.add_argument("--cache-dir", required=True)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--dtype", default="bfloat16")
    args = parser.parse_args()
    QwenRuntime.warmup_dependencies()
    EngineServer(
        Path(args.app_data_dir),
        Path(args.cache_dir),
        args.device,
        args.dtype,
    ).serve()


if __name__ == "__main__":
    main()
