// Public repository metadata only. No profile writes or automatic installation.
export const UPDATE_REPO = 'cx-xx-xc/fake_aim';
export const UPDATE_PACKAGE = '@local/aim-trainer';

export function compareVersions(left, right) {
  const parse = (value) => {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) throw new Error('Invalid version');
    const parts = value.split('.').map(Number);
    if (!parts.every(Number.isSafeInteger)) throw new Error('Invalid version');
    return parts;
  };
  const a = parse(left), b = parse(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

export async function checkForUpdates(currentVersion, { fetcher = globalThis.fetch, signal } = {}) {
  const get = async (url, headers = {}) => {
    const response = await fetcher(url, { signal, cache: 'no-store', credentials: 'omit', headers });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    return response.json();
  };
  // Read the manifest at the exact commit checked, so the offered installation
  // cannot drift to another version while the user reads the result.
  const commit = await get(`https://api.github.com/repos/${UPDATE_REPO}/commits/main`);
  if (typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Invalid GitHub commit');
  const manifest = await get(`https://api.github.com/repos/${UPDATE_REPO}/contents/package.json?ref=${commit.sha}`, { Accept: 'application/vnd.github.raw+json' });
  if (manifest.name !== UPDATE_PACKAGE || !manifest.dsh?.bundle?.patch) throw new Error('Invalid plugin manifest');
  const difference = compareVersions(manifest.version, currentVersion);
  return {
    status: difference > 0 ? 'available' : difference < 0 ? 'ahead' : 'current',
    version: manifest.version,
    spec: `github:${UPDATE_REPO}#${commit.sha}`,
    url: `https://github.com/${UPDATE_REPO}/commit/${commit.sha}`,
  };
}
