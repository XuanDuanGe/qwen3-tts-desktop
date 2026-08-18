export function registerEngineEvents(engine, logger, getWindow) {
  function send(channel, payload) {
    const window = getWindow();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }
    try {
      window.webContents.send(channel, payload);
    } catch {
      // The window may close between the state check and send.
    }
  }

  engine.on('status', (status) => {
    send('engine:status-changed', status);
  });

  engine.on('event', (message) => {
    logger.debug('engine', `event ${message.event}`);
    const channel = {
      'job.updated': 'engine:job-updated',
      'artifact.created': 'engine:artifact-created',
    }[message.event];
    if (!channel) {
      return;
    }
    if (message.event === 'artifact.created') {
      logger.info('artifact', 'artifact created received; forwarding to renderer');
    }
    send(channel, message.payload);
    if (message.event === 'artifact.created') {
      logger.info('artifact', 'artifact forwarded to renderer for preview');
    }
  });

  engine.on('stderr', (message) => {
    for (const line of message.split(/\r?\n/)) {
      if (line.trim()) logger.warn('python', line.trim());
    }
  });
}
