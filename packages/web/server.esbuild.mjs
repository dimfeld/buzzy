import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  outfile: 'server/index.js',
  platform: 'node',
  format: 'esm',
  packages: 'external',
  external: ['../build/*'],
  target: 'node18',
});
