import { ipcMain } from 'electron';

const EVENTS = new Set([
  'app_started',
  'engine_bootstrap_started',
  'engine_ready',
  'engine_unavailable',
  'page_view',
  'component_used',
  'model_capabilities_requested',
  'generation_submitted',
  'generation_succeeded',
  'generation_failed',
  'artifact_downloaded',
  'artifact_preview_ready',
]);
const ROUTES = new Set(['home', 'voice_generate', 'voice_clone', 'settings']);
const COMPONENTS = new Set([
  'engine_bootstrap',
  'sidebar',
  'title_bar',
  'home_page',
  'voice_generate_page',
  'voice_clone_page',
  'settings_page',
]);

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
  if (event === 'page_view' && !ROUTES.has(result.route)) {
    throw new Error('invalid telemetry route');
  }
  if (event === 'component_used' && !COMPONENTS.has(result.component)) {
    throw new Error('invalid telemetry component');
  }
  return result;
}

export function registerTelemetryHandler(logger) {
  ipcMain.handle('telemetry:track', (event, name, properties) => {
    if (typeof name !== 'string' || !EVENTS.has(name)) {
      throw new Error('invalid telemetry event');
    }
    const safeProperties = validateProperties(name, properties);
    logger.info('telemetry', `${name} ${JSON.stringify(safeProperties)}`);
    return { tracked: true };
  });
}
