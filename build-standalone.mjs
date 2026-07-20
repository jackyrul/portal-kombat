// Builds portal-kombat-standalone.html — a single file that runs from file://
// (double-click, no server). Usage: node build-standalone.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const js = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  alias: {
    'three/addons': './vendor/three',
    'three': './vendor/three/three.module.js',
  },
});

const css = readFileSync('css/style.css', 'utf8');
let html = readFileSync('index.html', 'utf8');

html = html
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/,
    () => `<script>\n${js.outputFiles[0].text}\n</script>`);

writeFileSync('portal-kombat-standalone.html', html);
console.log(`portal-kombat-standalone.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
