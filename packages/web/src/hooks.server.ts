import { building } from '$app/environment';
import { websocketSession } from '$lib/server/ws';

import { getWebsocketServer } from '$lib/server/ws_node';

if (!building) {
  const wsServer = getWebsocketServer();
  wsServer.removeAllListeners('connection');
  wsServer.on('connection', websocketSession);
}

export function handle({ event, resolve }) {
  return resolve(event);
}
