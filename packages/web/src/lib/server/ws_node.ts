import { parse } from 'url';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { websocketSession } from './ws';

let wsServer: WebSocketServer | null = null;

export function getWebsocketServer(): WebSocketServer {
  if (wsServer) {
    return wsServer;
  }

  wsServer = new WebSocketServer({
    noServer: true,
  });

  wsServer.on('connection', websocketSession);

  return wsServer;
}

export function handleWsUpgrade(wsServer: WebSocketServer) {
  return (req: IncomingMessage, sock: Duplex, head: Buffer) => {
    const path = req.url ? parse(req.url).pathname : null;
    if (path !== '/ws') {
      return;
    }

    wsServer.handleUpgrade(req, sock, head, (ws) => {
      wsServer.emit('connection', ws, req);
    });
  };
}
