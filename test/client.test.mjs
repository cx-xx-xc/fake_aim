import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await readFile(path.join(root, 'client.js'), 'utf8');

// 1. The bundle must at least parse: the Harness loads it as one plain script.
new Function(bundle);
assert.match(bundle, /window\.__ModuleLoader__\.load\(\{/);
assert.match(bundle, /id: '@local\/aim-trainer'/);
assert.match(bundle, /class MqttClient/, 'net/mqtt.js is inlined');
assert.match(bundle, /function openRoom/, 'net/link.js is inlined');
assert.match(bundle, /function buildTargets/, 'net/room.js is inlined');

// 2. Both locale tables must expose the same keys.
const dictStart = bundle.indexOf('const DICTS = {');
const dictEnd = bundle.indexOf('const CSS =');
assert.ok(dictStart > 0 && dictEnd > dictStart, 'DICTS block found');
const dictSource = bundle.slice(dictStart, dictEnd);
const enStart = dictSource.indexOf('en: {');
const zhStart = dictSource.indexOf('zh: {');
assert.ok(zhStart > enStart, 'both locales present');

const keysOf = (text) => [...text.matchAll(/(?:^|[\s,{])([A-Za-z][A-Za-z0-9]*):/g)]
  .map((match) => match[1])
  .filter((key) => key !== 'en' && key !== 'zh');
const en = new Set(keysOf(dictSource.slice(enStart, zhStart)));
const zh = new Set(keysOf(dictSource.slice(zhStart)));

assert.deepEqual([...en].filter((key) => !zh.has(key)), [], 'zh is missing keys present in en');
assert.deepEqual([...zh].filter((key) => !en.has(key)), [], 'en is missing keys present in zh');

// 3. Duel drills position targets from buildTargets(), whose coordinates are
//    normalised 0..1 — rendering them straight as percentages pinned every orb
//    to the arena's top-left corner. Guard the conversion in both duel modes.
assert.match(bundle, /left: target\.x \* 100 \+ '%'/, 'duel click scales x to percent');
assert.match(bundle, /top: target\.y \* 100 \+ '%'/, 'duel click scales y to percent');
assert.match(bundle, /left: spot\.x \* 100 \+ '%'/, 'duel reaction scales x to percent');
assert.match(bundle, /top: spot\.y \* 100 \+ '%'/, 'duel reaction scales y to percent');

// 4. Every t('key') the code asks for exists in both locales.
const used = new Set([...bundle.matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)].map((match) => match[1]));
const missing = [...used].filter((key) => !en.has(key));
assert.deepEqual(missing, [], `missing locale keys: ${missing.join(', ')}`);

console.log(`[client] PASS  bundle parses, ${en.size} locale keys, ${used.size} used in code`);
