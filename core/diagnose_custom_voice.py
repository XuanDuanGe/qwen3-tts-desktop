import argparse
import time
from pathlib import Path

import soundfile as sf

from qwen_tts_engine.paths import RuntimePaths
from qwen_tts_engine.runtime import QwenRuntime


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--device', default='cpu')
    parser.add_argument('--dtype', default='float32')
    args = parser.parse_args()

    model_id = 'qwen3-tts-12hz-1.7b-customvoice'
    model_dir = Path(args.model_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = RuntimePaths(output_dir, output_dir / 'cache')
    paths.prepare()
    if not model_dir.is_dir():
        raise FileNotFoundError(model_dir)

    runtime = QwenRuntime(args.device, args.dtype)
    load_started = time.monotonic()
    print(f'loading model: {model_dir}', flush=True)
    runtime.load(model_id, model_dir)
    print(f'loaded in {time.monotonic() - load_started:.1f}s', flush=True)
    generate_started = time.monotonic()
    wavs, sample_rate = runtime.generate(
        'custom_voice',
        {
            'text': '大家好，我是锤子猫',
            'speaker': 'Ono_Anna',
            'language': 'Chinese',
        },
    )
    target = output_dir / 'qwen3-tts-1.7b-customvoice-ono-anna.wav'

    sf.write(target, wavs[0], sample_rate, format='WAV')
    print(f'generated in {time.monotonic() - generate_started:.1f}s', flush=True)
    print(f'output: {target}', flush=True)
    runtime.unload()


if __name__ == '__main__':
    main()
