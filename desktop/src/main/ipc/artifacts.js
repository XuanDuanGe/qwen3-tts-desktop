import { app, ipcMain } from 'electron';
import { access, copyFile, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { getEnginePaths } from '../engine/paths.js';
import { getManager, requireString, validateSender } from './common.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireArtifactId(artifactId) {
  const value = requireString(artifactId, 'artifactId');
  if (!UUID_PATTERN.test(value)) {
    throw new Error('artifactId must be a valid UUID');
  }
  return value.toLowerCase();
}

function getArtifactPath(artifactId) {
  return join(getEnginePaths().appData, 'outputs', `${artifactId}.wav`);
}

async function requireArtifactFile(artifactId) {
  const path = getArtifactPath(artifactId);
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error('Artifact not found');
  }
  return path;
}

export function registerArtifactHandlers(manager) {
  ipcMain.handle('artifacts:get', (event, artifactId) => {
    const engine = getManager(event, manager);
    return engine.request('artifacts.get', {
      artifactId: requireArtifactId(artifactId),
    });
  });

  ipcMain.handle('artifacts:delete', (event, artifactId) => {
    const engine = getManager(event, manager);
    return engine.request('artifacts.delete', {
      artifactId: requireArtifactId(artifactId),
    });
  });

  ipcMain.handle('artifacts:read', async (event, artifactId) => {
    validateSender(event);
    const path = await requireArtifactFile(requireArtifactId(artifactId));
    return readFile(path);
  });

  ipcMain.handle('artifacts:download', async (event, artifactId) => {
    validateSender(event);
    const normalizedArtifactId = requireArtifactId(artifactId);
    const source = await requireArtifactFile(normalizedArtifactId);
    const fileName = `qwen3-tts-${normalizedArtifactId}.wav`;
    const target = join(app.getPath('downloads'), fileName);
    await copyFile(source, target);
    return { fileName };
  });
}
