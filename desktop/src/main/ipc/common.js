import { BrowserWindow } from 'electron';

export function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

export function validateSender(event) {
  const window = getWindow(event);
  if (!window || window.isDestroyed()) {
    throw new Error('Invalid renderer window');
  }
  return window;
}

export function getManager(event, manager) {
  validateSender(event);
  return manager;
}

export function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

export function requireArtifactId(value) {
  const artifactId = requireString(value, 'artifactId');
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(artifactId)) {
    throw new Error('artifactId must be a UUID');
  }
  return artifactId;
}

export function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}
