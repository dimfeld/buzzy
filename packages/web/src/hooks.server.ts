import { building } from '$app/environment';
import { getWebsocketServer } from '$lib/server/ws_node';
import { handleUpgrade } from '$lib/server/ws';

if (!building) {
  const wsServer = getWebsocketServer();
  wsServer.removeAllListeners('handleUpgrade');
  wsServer.on('handleUpgrade', handleUpgrade);
}

export function handle({ event, resolve }) {
  return resolve(event);
}
