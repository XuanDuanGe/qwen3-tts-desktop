const engine = window.api.engine;

export function getEngineStatus() {
  return engine.getStatus();
}

export function listModels() {
  return engine.models.list();
}

export function getModelCapabilities(modelId) {
  return engine.models.capabilities(modelId);
}

export function installModel(modelId, proxy) {
  return engine.models.install(modelId, proxy);
}

export function submitJob(params) {
  return engine.jobs.submit(params);
}

export function getJob(jobId) {
  return engine.jobs.get(jobId);
}

export function cancelJob(jobId) {
  return engine.jobs.cancel(jobId);
}

export function getArtifact(artifactId) {
  return engine.artifacts.get(artifactId);
}

export function deleteArtifact(artifactId) {
  return engine.artifacts.delete(artifactId);
}

export function readArtifact(artifactId) {
  return engine.artifacts.read(artifactId);
}

export function downloadArtifact(artifactId) {
  return engine.artifacts.download(artifactId);
}

export function onEngineStatus(listener) {
  return engine.onStatus(listener);
}

export function onJobUpdated(listener) {
  return engine.onJobUpdated(listener);
}

export function onArtifactCreated(listener) {
  return engine.onArtifactCreated(listener);
}
