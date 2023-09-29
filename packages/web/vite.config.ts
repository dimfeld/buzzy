import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, ModuleNode, type PluginOption } from 'vite';
import { getWebsocketServer, handleWsUpgrade } from './src/lib/server/ws_node';

function doesImportServerHooks(node: ModuleNode, seen: Set<string>) {
  if (!node.file) {
    return false;
  }

  if (node.file.endsWith('src/hooks.server.ts')) {
    return true;
  }

  if (seen.has(node.file)) {
    return false;
  }

  seen.add(node.file);

  for (const mod of node.importers) {
    if (doesImportServerHooks(mod, seen)) {
      return true;
    }
  }

  return false;
}

const wsServer: PluginOption = {
  name: 'websockets',
  configureServer(server) {
    server.httpServer?.on('upgrade', handleWsUpgrade);
  },
  configurePreviewServer(server) {
    server.httpServer?.on('upgrade', handleWsUpgrade);
  },
  handleHotUpdate(ctx) {
    const seen = new Set<string>();
    if (
      ctx.file.endsWith('src/hooks.server.ts') ||
      ctx.modules.some((s) => doesImportServerHooks(s, seen))
    ) {
      const wsServer = getWebsocketServer();
      console.warn(`removing ${wsServer.listenerCount('connection')} listeners`);
      wsServer.removeAllListeners('connection');
    }
  },
};

export default defineConfig({
  plugins: [sveltekit(), wsServer],
  // Get .env from the root directory
  envDir: '../..',
  ssr: {
    noExternal: [
      // These don't conform exactly to what Node.js expects for ESM, so
      // just sticking them in noExternal lets Vite process them instead.
      '@picovoice/web-voice-processor',
      '@picovoice/porcupine-web',
      '@picovoice/cobra-web',
    ],
  },
});
