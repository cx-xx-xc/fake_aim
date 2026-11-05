import assert from 'node:assert/strict';
import { checkForUpdates, compareVersions } from '../src/updates.js';

const sha = 'a'.repeat(40);
const manifest = (version) => ({ name: '@local/aim-trainer', version, dsh: { bundle: { patch: './cordis.patch.yml' } } });
function fetcherFor(body) {
  const calls = [];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => calls.length === 1 ? { sha } : body };
  } };
}
assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
assert.equal(compareVersions('1.2.2', '1.2.2'), 0);
assert.throws(() => compareVersions('bad', '1.0.0'));
for (const [remote, status] of [['1.3.0', 'available'], ['1.2.2', 'current'], ['1.2.1', 'ahead']]) {
  const fake = fetcherFor(manifest(remote));
  const controller = new AbortController();
  const result = await checkForUpdates('1.2.2', { fetcher: fake.fetcher, signal: controller.signal });
  assert.equal(result.status, status);
  assert.equal(result.spec, `github:cx-xx-xc/fake_aim#${sha}`);
  assert.equal(fake.calls[1].url, `https://api.github.com/repos/cx-xx-xc/fake_aim/contents/package.json?ref=${sha}`);
  assert.equal(fake.calls[1].options.headers.Accept, 'application/vnd.github.raw+json');
  assert.ok(fake.calls.every(({ options }) => options.cache === 'no-store' && options.credentials === 'omit' && options.signal === controller.signal));
}
for (const body of [manifest('bad'), { ...manifest('1.3.0'), name: 'other' }, { name: '@local/aim-trainer', version: '1.3.0' }]) {
  await assert.rejects(checkForUpdates('1.2.2', fetcherFor(body)));
}
await assert.rejects(checkForUpdates('1.2.2', { fetcher: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
await assert.rejects(checkForUpdates('1.2.2', { fetcher: async () => { throw new TypeError('Failed to fetch'); } }), /Failed to fetch/);
await assert.rejects(checkForUpdates('1.2.2', { fetcher: async () => ({ ok: true, json: async () => ({ sha: 'bad' }) }) }), /Invalid GitHub commit/);
const controller = new AbortController();
controller.abort();
await assert.rejects(checkForUpdates('1.2.2', { signal: controller.signal, fetcher: async (_, { signal }) => { signal.throwIfAborted(); } }), { name: 'AbortError' });
console.log('[updates] PASS version comparison, immutable install target, invalid metadata, HTTP/network failures and abort');
