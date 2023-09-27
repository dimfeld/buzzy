import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type PluginOption } from 'vite';
import { handleWsUpgrade } from './src/lib/server/ws_node';

const wsServer: PluginOption = {
  name: 'websockets',
  configureServer(server) {
    server.httpServer?.on('upgrade', handleWsUpgrade);
  },
  configurePreviewServer(server) {
    server.httpServer?.on('upgrade', handleWsUpgrade);
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
