export function registerEngineEvents(engine, logger, getWindow) {
  engine.on('status', (status) => {
    getWindow()?.webContents.send('engine:status-changed', status);
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
    getWindow()?.webContents.send(channel, message.payload);
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
