// Bundles the Electron main + preload processes to CommonJS. Electron's main
// process runs CJS, so we ship `.cjs`. `electron` is provided by the runtime and
// the Next standalone server is required dynamically at runtime — both external.
import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outExtension: { '.js': '.cjs' },
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
}

await Promise.all([
  build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.cjs' }),
  build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.cjs' }),
])
