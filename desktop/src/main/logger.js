import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function timestamp(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function lineTimestamp(date = new Date()) {
  return `${timestamp(date)}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function createLogger(appData, level = process.env.QWEN_TTS_LOG_LEVEL || 'info') {
  const threshold = LEVELS[level] || LEVELS.info;
  const logsDir = join(appData, 'logs');
  const filePath = join(logsDir, `${timestamp()}.log`);
  let ready = false;
  try {
    mkdirSync(logsDir, { recursive: true });
    ready = true;
  } catch (error) {
    console.error(`[logger] unable to create log directory: ${error.message}`);
  }

  function write(name, module, message) {
    if (LEVELS[name] < threshold) return;
    const line = `${lineTimestamp()} [${name.toUpperCase()}] [${module}] ${message}`;
    if (name === 'error') console.error(line);
    else if (name === 'warn') console.warn(line);
    else console.log(line);
    if (ready) {
      try {
        appendFileSync(filePath, `${line}\n`, 'utf8');
      } catch (error) {
        ready = false;
        console.error(`[logger] unable to write log file: ${error.message}`);
      }
    }
  }

  return {
    filePath,
    debug: (module, message) => write('debug', module, message),
    info: (module, message) => write('info', module, message),
    warn: (module, message) => write('warn', module, message),
    error: (module, message) => write('error', module, message),
  };
}
