import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const sidecar = resolve('build-resources/engine/qwen-tts-engine.exe');
try {
  await access(sidecar, constants.F_OK);
  console.log(`Sidecar ready: ${sidecar}`);
} catch {
  console.error(`Missing packaged sidecar: ${sidecar}`);
  process.exitCode = 1;
}
