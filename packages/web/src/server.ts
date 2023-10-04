import { handleWsUpgrade } from './lib/server/ws_node.js';
import { server } from '../build/index.js';

server.server.on('upgrade', handleWsUpgrade);
