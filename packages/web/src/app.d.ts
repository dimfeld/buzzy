import type { WebSocketServer } from 'ws';
import type ky from 'ky';

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      ky: typeof ky;
      wss: WebSocketServer;
    }
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
