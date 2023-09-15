import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
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
