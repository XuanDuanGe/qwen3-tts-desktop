export const TELEMETRY_EVENTS = new Set([
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

export const TELEMETRY_ROUTES = new Set([
  'home',
  'voice_generate',
  'voice_clone',
  'settings',
]);

export const TELEMETRY_COMPONENTS = new Set([
  'engine_bootstrap',
  'sidebar',
  'title_bar',
  'home_page',
  'voice_generate_page',
  'voice_clone_page',
  'settings_page',
]);
