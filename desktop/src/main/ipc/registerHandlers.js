import { registerArtifactHandlers } from './artifacts.js';
import { registerEngineHandlers } from './engine.js';
import { registerGreetHandler } from './greet.js';
import { registerTelemetryHandler } from './telemetry.js';
import { registerWindowControlHandlers } from './windowControls.js';

export function registerHandlers(engine, logger) {
  registerGreetHandler();
  registerEngineHandlers(engine);
  registerArtifactHandlers(engine);
  registerWindowControlHandlers();
  registerTelemetryHandler(logger);
}
