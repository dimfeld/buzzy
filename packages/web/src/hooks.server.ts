import { building } from '$app/environment';
import ky from 'ky';

import { getWebsocketServer } from '$lib/server/ws_node';

export function handle({ event, resolve }) {
  event.locals.ky = ky.extend({ fetch });

  if (!building) {
    getWebsocketServer();
  }

  return resolve(event);
}
