export const GHOST_KEY = 'aim-trainer:ghost:click:v1';
export const GHOST_ENABLED_KEY = 'aim-trainer:ghost:enabled:v1';

export function validGhost(value, durationMs) {
  return value?.version === 1 && value.durationMs === durationMs
    && Array.isArray(value.hits) && value.hits.length > 0 && value.hits.length <= 10000
    && value.hits.every((time, index) => Number.isFinite(time) && time >= 0
      && time < durationMs && (index === 0 || time >= value.hits[index - 1]));
}

export function readGhost(storage, durationMs) {
  try {
    const value = JSON.parse(storage.getItem(GHOST_KEY));
    return validGhost(value, durationMs) ? value : null;
  } catch { return null; }
}

// Only completed runs call this. Tied or lower scores preserve the existing replay.
export function saveGhost(storage, hits, durationMs) {
  const candidate = { version: 1, durationMs, hits: [...hits] };
  if (!validGhost(candidate, durationMs)) return false;
  const previous = readGhost(storage, durationMs);
  if (previous && previous.hits.length >= hits.length) return false;
  try { storage.setItem(GHOST_KEY, JSON.stringify(candidate)); return true; }
  catch { return false; }
}

export function ghostScoreAt(ghost, elapsedMs) {
  if (!ghost || !Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  let low = 0;
  let high = ghost.hits.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ghost.hits[middle] <= elapsedMs) low = middle + 1;
    else high = middle;
  }
  return low;
}
