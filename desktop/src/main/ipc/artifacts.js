import { ipcMain } from 'electron';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { getEnginePaths } from '../engine/paths.js';
import { getManager, requireString, validateSender } from './common.js';
import { readSettings } from './settings.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDownloadFileName(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.wav`;
}

function getOutputsDir() {
  return join(getEnginePaths().appData, 'outputs');
}

function getArtifactJsonPath(artifactId) {
  return join(getOutputsDir(), `${artifactId}.json`);
}

function getArtifactAudioPath(fileName) {
  return join(getOutputsDir(), fileName);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function buildRecord(artifactId, fileName, meta, fileStat) {
  return {
    artifactId,
    fileName,
    mimeType: typeof meta?.mimeType === 'string' ? meta.mimeType : 'audio/wav',
    sampleRate:
      typeof meta?.sampleRate === 'number' ? meta.sampleRate : undefined,
    createdAt:
      typeof meta?.createdAt === 'number' ? meta.createdAt : fileStat.mtimeMs,
  };
}

async function loadArtifactRecord(artifactId) {
  const metaPath = getArtifactJsonPath(artifactId);
  const meta = await readJson(metaPath);
  if (meta) {
    const fileName =
      typeof meta.fileName === 'string' && meta.fileName.trim()
        ? meta.fileName.trim()
        : `${artifactId}.wav`;
    const audioPath = getArtifactAudioPath(fileName);
    try {
      await access(audioPath, constants.R_OK);
      return buildRecord(
        typeof meta.artifactId === 'string' && meta.artifactId.trim()
          ? meta.artifactId.trim()
          : artifactId,
        fileName,
        meta,
        await stat(audioPath),
      );
    } catch {
      return null;
    }
  }

  const fallbackName = `${artifactId}.wav`;
  const fallbackPath = getArtifactAudioPath(fallbackName);
  try {
    await access(fallbackPath, constants.R_OK);
    return buildRecord(artifactId, fallbackName, null, await stat(fallbackPath));
  } catch {
    return null;
  }
}

async function listArtifactRecords() {
  await mkdir(getOutputsDir(), { recursive: true });
  const entries = await readdir(getOutputsDir(), { withFileTypes: true });
  const records = [];
  const seenFiles = new Set();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.tmp.json')) {
      continue;
    }
    const artifactId = entry.name.replace(/\.json$/i, '');
    const record = await loadArtifactRecord(artifactId);
    if (!record) {
      continue;
    }
    records.push(record);
    seenFiles.add(record.fileName);
  }

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith('.wav') ||
      entry.name.endsWith('.tmp.wav') ||
      seenFiles.has(entry.name)
    ) {
      continue;
    }
    const filePath = getArtifactAudioPath(entry.name);
    const fileStat = await stat(filePath);
    records.push(
      await buildRecord(entry.name.replace(/\.wav$/i, ''), entry.name, null, fileStat),
    );
  }

  records.sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  return records;
}

export function registerArtifactHandlers(manager) {
  ipcMain.handle('artifacts:list', async (event) => {
    validateSender(event);
    return { artifacts: await listArtifactRecords() };
  });

  ipcMain.handle('artifacts:get', async (event, artifactId) => {
    getManager(event, manager);
    const record = await loadArtifactRecord(requireString(artifactId, 'artifactId'));
    if (!record) {
      throw new Error('Artifact not found');
    }
    return record;
  });

  ipcMain.handle('artifacts:delete', async (event, artifactId) => {
    getManager(event, manager);
    const normalizedArtifactId = requireString(artifactId, 'artifactId');
    const record = await loadArtifactRecord(normalizedArtifactId);
    if (!record) {
      throw new Error('Artifact not found');
    }
    await Promise.all([
      unlink(getArtifactAudioPath(record.fileName)).catch(() => undefined),
      unlink(getArtifactJsonPath(normalizedArtifactId)).catch(() => undefined),
    ]);
    return { deleted: true };
  });

  ipcMain.handle('artifacts:read', async (event, artifactId) => {
    validateSender(event);
    const record = await loadArtifactRecord(requireString(artifactId, 'artifactId'));
    if (!record) {
      throw new Error('Artifact not found');
    }
    return readFile(getArtifactAudioPath(record.fileName));
  });

  ipcMain.handle('artifacts:download', async (event, artifactId) => {
    validateSender(event);
    const normalizedArtifactId = requireString(artifactId, 'artifactId');
    const record = await loadArtifactRecord(normalizedArtifactId);
    if (!record) {
      throw new Error('Artifact not found');
    }
    const settings = await readSettings();
    const downloadDir = settings.audioDownloadDir;
    const fileName = formatDownloadFileName();
    const target = join(downloadDir, fileName);
    await mkdir(downloadDir, { recursive: true });
    await copyFile(getArtifactAudioPath(record.fileName), target);
    return { fileName, target };
  });
}
