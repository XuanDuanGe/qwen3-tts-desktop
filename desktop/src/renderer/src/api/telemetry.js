import {
  TELEMETRY_COMPONENTS,
  TELEMETRY_EVENTS,
  TELEMETRY_ROUTES,
} from '../../../shared/telemetry';

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
  if (!TELEMETRY_EVENTS.has(name)) return;
  if (name === 'page_view' && !TELEMETRY_ROUTES.has(properties.route)) return;
  if (name === 'component_used' && !TELEMETRY_COMPONENTS.has(properties.component)) return;
  const key = `${name}:${JSON.stringify(properties)}`;
  if (once && seen.has(key)) return;
  seen.add(key);
  window.api.telemetry.track(name, safeProperties(properties));
}
