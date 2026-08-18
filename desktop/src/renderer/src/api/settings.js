const settings = window.api.settings;

export function getSettings() {
  return settings.get();
}

export function saveSettings(value) {
  return settings.save(value);
}
