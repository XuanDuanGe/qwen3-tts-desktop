import { ipcMain } from 'electron';
import {
  TELEMETRY_COMPONENTS,
  TELEMETRY_EVENTS,
  TELEMETRY_ROUTES,
} from '../../shared/telemetry.js';

function validateProperties(event, properties = {}) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error('telemetry properties must be an object');
  }
  const result = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof key !== 'string' ||
      key.length > 32 ||
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') ||
      (typeof value === 'string' && value.length > 80)
    ) {
      throw new Error('invalid telemetry property');
    }
    result[key] = value;
  }
  if (event === 'page_view' && !TELEMETRY_ROUTES.has(result.route)) {
    throw new Error('invalid telemetry route');
  }
  if (event === 'component_used' && !TELEMETRY_COMPONENTS.has(result.component)) {
    throw new Error('invalid telemetry component');
  }
  return result;
}

export function registerTelemetryHandler(logger) {
  ipcMain.handle('telemetry:track', (event, name, properties) => {
    if (typeof name !== 'string' || !TELEMETRY_EVENTS.has(name)) {
      throw new Error('invalid telemetry event');
    }
    const safeProperties = validateProperties(name, properties);
    logger.info('telemetry', `${name} ${JSON.stringify(safeProperties)}`);
    return { tracked: true };
  });
}
