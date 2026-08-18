export const PROTOCOL_VERSION = 1;

export function createRequest(requestId, method, params = {}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: 'request',
    requestId,
    method,
    params,
  };
}

export function parseMessage(line) {
  const message = JSON.parse(line);

  if (
    message.protocolVersion !== PROTOCOL_VERSION ||
    typeof message.type !== 'string'
  ) {
    throw new Error('Invalid engine protocol message');
  }

  if (message.type === 'response' && typeof message.requestId !== 'string') {
    throw new Error('Invalid engine response');
  }

  if (message.type === 'event' && typeof message.event !== 'string') {
    throw new Error('Invalid engine event');
  }

  return message;
}
