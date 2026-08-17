import { invoke } from '@tauri-apps/api/core';

const marks = new Map();
const sentEvents = new Set();
const trackedViews = new Set();

const formatContext = (context = {}) => JSON.stringify(context);

const sendMetric = async (event, durationMs, context) => {
  try {
    await invoke('record_frontend_metric', {
      event,
      durationMs,
      context: formatContext(context),
    });
  } catch (error) {
    console.warn('[telemetry] failed to send metric', event, error);
  }
};

export function mark(name, context = {}) {
  if (!marks.has(name)) {
    marks.set(name, performance.now());
  }

  void sendMetric(`${name}.mark`, null, context);
}

export function remark(name, context = {}) {
  marks.set(name, performance.now());
  void sendMetric(`${name}.remark`, null, context);
}

export function measure(name, startMark, context = {}) {
  const startedAt = marks.get(startMark);

  if (typeof startedAt !== 'number') {
    return null;
  }

  const durationMs = performance.now() - startedAt;
  void sendMetric(name, durationMs, context);
  return durationMs;
}

export function track(event, context = {}) {
  void sendMetric(event, null, context);
}

export function trackOnce(event, context = {}) {
  if (sentEvents.has(event)) {
    return;
  }

  sentEvents.add(event);
  track(event, context);
}

export function trackPageView(pathname, context = {}) {
  if (trackedViews.has(pathname)) {
    return;
  }

  trackedViews.add(pathname);
  track('page.view', { pathname, ...context });
}
