const EVENT_NAMES = new Set([
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
const seen = new Set();

function safeProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        typeof key === 'string' &&
        key.length <= 32 &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
        (typeof value !== 'string' || value.length <= 80),
    ),
  );
}

export function track(name, properties = {}, { once = false } = {}) {
  if (!EVENT_NAMES.has(name)) return;
  if (name === 'page_view' && !ROUTES.has(properties.route)) return;
  if (name === 'component_used' && !COMPONENTS.has(properties.component)) return;
  const key = `${name}:${JSON.stringify(properties)}`;
  if (once && seen.has(key)) return;
  seen.add(key);
  window.api.telemetry.track(name, safeProperties(properties));
}
