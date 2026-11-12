// Generates client.js from the tested net layer plus src/trainer.js.
//
// The Harness client bundle is a single plain script handed to
// window.__ModuleLoader__.load(), so it cannot import sibling files. The net
// modules stay ordinary ESM for node:test; this script strips their imports and
// export keywords and pastes them into the factory so the browser runs exactly
// the code the tests cover.
//
//   node tools/build-client.mjs           # write client.js
//   node tools/build-client.mjs --check   # fail if client.js is stale
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const NET = ['mqtt.js', 'room.js', 'link.js'];

function inlineModule(source, name) {
  const stripped = source
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];[ \t]*\r?\n/gm, '')
    .replace(/^export\s+(const|let|var|function|class|async function)\b/gm, '$1');
  if (/^[ \t]*(?:import|export)\b/m.test(stripped)) {
    throw new Error(`net/${name} still contains module syntax the bundler cannot inline`);
  }
  const indented = stripped.replace(/^(?=.)/gm, '    ');
  return `    // ---- net/${name} ----\n${indented.trimEnd()}\n`;
}

const parts = [];
for (const name of NET) {
  const source = await readFile(path.join(root, 'net', name), 'utf8');
  parts.push(inlineModule(source, name));
}

const body = await readFile(path.join(root, 'src', 'trainer.js'), 'utf8');
const updates = inlineModule(await readFile(path.join(root, 'src', 'updates.js'), 'utf8'), '../src/updates.js');
const ghost = inlineModule(await readFile(path.join(root, 'src', 'ghost.js'), 'utf8'), '../src/ghost.js');
const feel = inlineModule(await readFile(path.join(root, 'src', 'feel.js'), 'utf8'), '../src/feel.js');
const scene = inlineModule(await readFile(path.join(root, 'src', 'scene3d.js'), 'utf8'), '../src/scene3d.js');
const range = inlineModule(await readFile(path.join(root, 'src', 'range.js'), 'utf8'), '../src/range.js');
const rangeUI = inlineModule(await readFile(path.join(root, 'src', 'range-ui.js'), 'utf8'), '../src/range-ui.js');
const appStyle = inlineModule(await readFile(path.join(root, 'src', 'app-style.js'), 'utf8'), '../src/app-style.js');

const out = `window.__ModuleLoader__.load({
  id: '@local/aim-trainer',
  factory(require) {
    const React = require('react');
${parts.join('')}
${updates}
${ghost}
${feel}
${scene}
${range}
${rangeUI}
${appStyle}
    // ---- src/trainer.js ----
${body.trimEnd()}
  },
});
`;

const target = path.join(root, 'client.js');

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8');
  if (current !== out) {
    console.error('client.js is stale: run node tools/build-client.mjs');
    process.exit(1);
  }
  console.log('client.js is up to date');
} else {
  await writeFile(target, out, 'utf8');
  console.log(`wrote client.js (${out.length} bytes)`);
}
