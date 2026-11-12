import assert from 'node:assert/strict';
import test from 'node:test';

// Keep the missing-feature failure readable during the initial red run.
const scene = await import('../src/scene3d.js').catch((error) => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const close = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
};

test('sceneDirection uses a unit forward ray with rightward yaw and upward pitch', () => {
  assert.equal(typeof scene.sceneDirection, 'function', 'sceneDirection is required');
  assert.deepEqual(scene.sceneDirection(0, 0), [0, 0, -1]);
  const right = scene.sceneDirection(Math.PI / 2, 0);
  close(right[0], 1);
  close(right[1], 0);
  close(right[2], 0);
  const upRight = scene.sceneDirection(Math.PI / 4, Math.PI / 6);
  close(upRight[0], Math.sqrt(3 / 8));
  close(upRight[1], 0.5);
  close(upRight[2], -Math.sqrt(3 / 8));
  close(Math.hypot(...upRight), 1);
  assert.deepEqual(scene.sceneDirection(NaN, Infinity), [0, 0, -1]);
});

test('rotateLook converts sensitivity from degrees per pixel and reverses mouse Y', () => {
  assert.equal(typeof scene.rotateLook, 'function', 'rotateLook is required');
  const look = scene.rotateLook({ yaw: 0, pitch: 0 }, 100, 50);
  close(look.yaw, 16 * Math.PI / 180);
  close(look.pitch, -8 * Math.PI / 180);
  const stationary = scene.rotateLook(look, 100, 100, 0);
  close(stationary.yaw, look.yaw);
  close(stationary.pitch, look.pitch);
});

test('rotateLook clamps vertical movement and rejects nonfinite input', () => {
  assert.equal(typeof scene.rotateLook, 'function', 'rotateLook is required');
  close(scene.rotateLook({}, 0, -1e6).pitch, 85 * Math.PI / 180);
  close(scene.rotateLook({}, 0, 1e6).pitch, -85 * Math.PI / 180);
  assert.deepEqual(scene.rotateLook({ yaw: NaN, pitch: Infinity }, NaN, Infinity), { yaw: 0, pitch: 0 });
  const look = scene.rotateLook({ yaw: 1e100, pitch: -1e100 }, 1e100, 1e100);
  assert.ok(Number.isFinite(look.yaw) && Number.isFinite(look.pitch));
  assert.ok(Math.abs(look.pitch) <= 85 * Math.PI / 180);
});

test('sceneTarget deterministically maps normalized points into shared world coordinates', () => {
  assert.equal(typeof scene.sceneTarget, 'function', 'sceneTarget is required');
  assert.deepEqual(scene.sceneTarget({ x: 0.25, y: 0.75, r: 0.025 }, 'target-7'), {
    id: 'target-7', x: -3.5, y: -2, z: -12, radius: 0.5,
  });
  close(scene.sceneTarget({ r: 0.035 }, 'fractional').radius, 0.7);
  assert.deepEqual(scene.sceneTarget({}, 0), { id: 0, x: 0, y: 0, z: -12, radius: 0.48 });
  assert.deepEqual(scene.sceneTarget({ x: -1, y: 2, r: -1 }, 1), {
    id: 1, x: -7, y: -4, z: -12, radius: 0.48,
  });
  assert.deepEqual(scene.sceneTarget({ x: NaN, y: Infinity, r: Infinity }, 2), {
    id: 2, x: 0, y: 0, z: -12, radius: 0.48,
  });
});

test('aimTarget returns the nearest intersected target object regardless of array order', () => {
  assert.equal(typeof scene.aimTarget, 'function', 'aimTarget is required');
  const far = { id: 'far', x: 0, y: 0, z: -12, radius: 1 };
  const near = { id: 'near', x: 0, y: 0, z: -5, radius: 0.5 };
  const wideNear = { id: 'wide', x: 0, y: 0, z: -7, radius: 4 };
  assert.equal(scene.aimTarget({}, [far, near]), near);
  assert.equal(scene.aimTarget({}, [near, wideNear]), wideNear, 'sort by sphere surface distance');
  assert.equal(scene.aimTarget({}, [wideNear, near]), wideNear);
});

test('aimTarget follows the same rotated forward ray as the rendered camera', () => {
  assert.equal(typeof scene.aimTarget, 'function', 'aimTarget is required');
  const angled = { id: 1, x: 6, y: 3, z: -6, radius: 0.2 };
  const camera = { yaw: Math.PI / 4, pitch: Math.atan(3 / Math.hypot(6, 6)) };
  assert.equal(scene.aimTarget(camera, [angled]), angled);
  assert.equal(scene.aimTarget({}, [angled]), null);
  assert.equal(scene.aimTarget({ yaw: -Math.PI / 4 }, [angled]), null);
});

test('aimTarget excludes misses and rear spheres, but includes tangent and enclosing spheres', () => {
  assert.equal(typeof scene.aimTarget, 'function', 'aimTarget is required');
  const tangent = { x: 1, y: 0, z: -5, radius: 1 };
  const enclosing = { x: 0, y: 0, z: 0, radius: 2 };
  assert.equal(scene.aimTarget({}, [tangent]), tangent);
  assert.equal(scene.aimTarget({}, [enclosing]), enclosing);
  assert.equal(scene.aimTarget({}, [{ x: 0, y: 0, z: 5, radius: 1 }]), null);
  assert.equal(scene.aimTarget({}, [{ x: 1.01, y: 0, z: -5, radius: 1 }]), null);
  assert.equal(scene.aimTarget({}, [null, {}, { x: 0, y: 0, z: -1, radius: -1 }, { x: 0, y: 0, z: NaN, radius: 1 }]), null);
  assert.equal(scene.aimTarget(), null);
});

test('createSceneRenderer gives an actionable error when WebGL is unavailable', () => {
  assert.equal(typeof scene.createSceneRenderer, 'function', 'createSceneRenderer is required');
  assert.throws(() => scene.createSceneRenderer(null), /canvas/i);
  assert.throws(() => scene.createSceneRenderer({ getContext: () => null }), /WebGL/i);
});
