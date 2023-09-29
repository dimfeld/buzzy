import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

const wsServerKey = Symbol.for('buzzy.wsServer');

type Global = typeof globalThis & {
  [wsServerKey]: WebSocketServer | undefined;
};

export function getWebsocketServer(): WebSocketServer {
  const existing = (globalThis as Global)[wsServerKey];
  if (existing) {
    return existing;
  }

  const wsServer = new WebSocketServer({
    noServer: true,
    path: '/ws',
  });

  (globalThis as Global)[wsServerKey] = wsServer;

  return wsServer;
}

export function handleWsUpgrade(req: IncomingMessage, sock: Duplex, head: Buffer) {
  console.log(`handleWsUpgrade: ${req.url}`);
  const wsServer = getWebsocketServer();
  console.log('shouldHandle', wsServer.shouldHandle(req));
  if (wsServer.shouldHandle(req)) {
    wsServer.handleUpgrade(req, sock, head, (ws) => {
      console.log('handled', req.url);
      wsServer.emit('connection', ws, req);
    });
  }
}
