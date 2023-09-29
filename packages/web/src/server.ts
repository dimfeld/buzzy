import { handleWsUpgrade } from './lib/server/ws_node';
import { server } from '../build/index';

server.server.on('upgrade', handleWsUpgrade);
