import { parse } from 'url';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { websocketSession } from './ws';

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

  wsServer.on('connection', websocketSession);

  return wsServer;
}

export function handleWsUpgrade(wsServer: WebSocketServer) {
  return (req: IncomingMessage, sock: Duplex, head: Buffer) => {
    if (wsServer.shouldHandle(req)) {
      wsServer.handleUpgrade(req, sock, head, (ws) => {
        wsServer.emit('connection', ws, req);
      });
    }
  };
}
