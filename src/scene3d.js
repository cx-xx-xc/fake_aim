// Small, dependency-free WebGL range. Camera position is always the world origin.
const SCENE_DEG = Math.PI / 180;
const SCENE_PITCH_LIMIT = 85 * SCENE_DEG;
const SCENE_FLOOR_Y = -4.6;
const sceneFinite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const sceneClamp = (value, low, high) => Math.min(high, Math.max(low, value));
const sceneAngle = (value) => sceneFinite(value) % (Math.PI * 2);

export function sceneDirection(yaw = 0, pitch = 0) {
  yaw = sceneAngle(yaw);
  pitch = sceneClamp(sceneFinite(pitch), -SCENE_PITCH_LIMIT, SCENE_PITCH_LIMIT);
  const horizontal = Math.cos(pitch);
  return [Math.sin(yaw) * horizontal, Math.sin(pitch), -Math.cos(yaw) * horizontal];
}

export function rotateLook(camera, dx, dy, sensitivity = 0.16) {
  const speed = Number.isFinite(sensitivity) && sensitivity >= 0 ? sensitivity : 0.16;
  const yawDelta = sceneFinite(sceneFinite(dx) * speed * SCENE_DEG);
  const pitchDelta = sceneFinite(sceneFinite(dy) * speed * SCENE_DEG);
  return {
    yaw: sceneAngle(sceneAngle(camera?.yaw) + sceneAngle(yawDelta)),
    pitch: sceneClamp(sceneFinite(camera?.pitch) - pitchDelta, -SCENE_PITCH_LIMIT, SCENE_PITCH_LIMIT),
  };
}

export function sceneTarget(point, id) {
  const x = sceneClamp(sceneFinite(point?.x, 0.5), 0, 1);
  const y = sceneClamp(sceneFinite(point?.y, 0.5), 0, 1);
  const radius = Number.isFinite(point?.r) && point.r > 0 && Number.isFinite(point.r * 20) ? point.r * 20 : 0.48;
  return { id, x: (x - 0.5) * 14, y: (0.5 - y) * 8, z: -12, radius };
}

function sceneValidTarget(target) {
  return target && Number.isFinite(target.x) && Number.isFinite(target.y)
    && Number.isFinite(target.z) && Number.isFinite(target.radius) && target.radius > 0;
}

export function aimTarget(camera, targets) {
  const direction = sceneDirection(camera?.yaw, camera?.pitch);
  let nearest = Infinity;
  let selected = null;
  for (const target of Array.isArray(targets) ? targets : []) {
    if (!sceneValidTarget(target)) continue;
    const along = target.x * direction[0] + target.y * direction[1] + target.z * direction[2];
    const distanceSquared = target.x ** 2 + target.y ** 2 + target.z ** 2;
    const discriminant = target.radius ** 2 - (distanceSquared - along ** 2);
    if (discriminant < 0 || !Number.isFinite(discriminant)) continue;
    const root = Math.sqrt(discriminant);
    if (along + root < 0) continue;
    const distance = Math.max(0, along - root);
    if (distance < nearest) {
      nearest = distance;
      selected = target;
    }
  }
  return selected;
}

// Column-major matrices, matching GLSL. Positive yaw turns the camera right.
function sceneIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function sceneMultiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
}

function sceneModel(position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const [x, y, z] = rotation;
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return new Float32Array([
    cz * cy * scale[0], sz * cy * scale[0], -sy * scale[0], 0,
    (cz * sy * sx - sz * cx) * scale[1], (sz * sy * sx + cz * cx) * scale[1], cy * sx * scale[1], 0,
    (cz * sy * cx + sz * sx) * scale[2], (sz * sy * cx - cz * sx) * scale[2], cy * cx * scale[2], 0,
    ...position, 1,
  ]);
}

function sceneView(yaw, pitch) {
  const forward = sceneDirection(yaw, pitch);
  const right = [Math.cos(sceneAngle(yaw)), 0, Math.sin(sceneAngle(yaw))];
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  return new Float32Array([
    right[0], up[0], -forward[0], 0,
    right[1], up[1], -forward[1], 0,
    right[2], up[2], -forward[2], 0,
    0, 0, 0, 1,
  ]);
}

function scenePerspective(fov, aspect) {
  const f = 1 / Math.tan(fov * SCENE_DEG / 2);
  const near = 0.035, far = 90;
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}

const SCENE_VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormal;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDistance;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vec4 eye = uView * world;
  vWorld = world.xyz;
  vNormal = normalize(uNormal * aNormal);
  vDistance = length(eye.xyz);
  gl_Position = uProjection * eye;
}`;

const SCENE_FRAGMENT = `
precision mediump float;
uniform vec3 uColor;
uniform vec3 uEye;
uniform float uGrid;
uniform float uGloss;
uniform float uEmission;
uniform float uFog;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vDistance;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 light = normalize(vec3(-0.45, 0.85, 0.4));
  vec3 view = normalize(uEye - vWorld);
  float diffuse = max(dot(normal, light), 0.0);
  float specular = pow(max(dot(normal, normalize(light + view)), 0.0), 48.0) * uGloss;
  vec3 color = uColor * (0.62 + diffuse * 0.4 + normal.y * 0.035);
  color += vec3(0.84, 0.91, 0.94) * specular;
  if (uGrid > 0.0) {
    vec3 n = abs(normal);
    vec2 coordinate = n.y > 0.5 ? vWorld.xz : (n.x > 0.5 ? vWorld.zy : vWorld.xy);
    vec2 edge = abs(fract(coordinate * 0.5 + 0.5) - 0.5);
    float width = 0.005 + min(vDistance, 35.0) * 0.0005;
    float line = 1.0 - smoothstep(width, width * 2.2, min(edge.x, edge.y));
    color *= 1.0 - line * 0.16 * uGrid;
  }
  float rim = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
  color += uColor * rim * uGloss * 0.12;
  color = mix(color, uColor, min(uEmission, 1.0)) + uColor * max(uEmission - 1.0, 0.0);
  float fog = (1.0 - exp(-vDistance * vDistance * 0.00075)) * uFog;
  gl_FragColor = vec4(mix(color, vec3(0.52, 0.56, 0.60), fog), 1.0);
}`;

function sceneCubeData() {
  const positions = [], normals = [], indices = [];
  const faces = [
    [[1, 0, 0], [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]]],
    [[-1, 0, 0], [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]]],
    [[0, 1, 0], [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]]],
    [[0, -1, 0], [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]],
    [[0, 0, 1], [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]],
    [[0, 0, -1], [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]],
  ];
  for (const [normal, vertices] of faces) {
    const first = positions.length / 3;
    for (const vertex of vertices) { positions.push(...vertex); normals.push(...normal); }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  return { positions, normals, indices };
}

function sceneSphereData() {
  const positions = [], normals = [], indices = [];
  const rings = 24, slices = 36;
  for (let ring = 0; ring <= rings; ring++) {
    const latitude = ring * Math.PI / rings;
    for (let slice = 0; slice <= slices; slice++) {
      const longitude = slice * Math.PI * 2 / slices;
      const normal = [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
      positions.push(...normal); normals.push(...normal);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let slice = 0; slice < slices; slice++) {
      const a = ring * (slices + 1) + slice, b = a + slices + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { positions, normals, indices };
}

function sceneCylinderData() {
  const positions = [], normals = [], indices = [];
  const slices = 24;
  for (let slice = 0; slice <= slices; slice++) {
    const angle = slice * Math.PI * 2 / slices, x = Math.cos(angle), y = Math.sin(angle);
    positions.push(x, y, -0.5, x, y, 0.5);
    normals.push(x, y, 0, x, y, 0);
    if (slice < slices) { const a = slice * 2; indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  }
  for (const sign of [-1, 1]) {
    const center = positions.length / 3;
    positions.push(0, 0, sign * 0.5); normals.push(0, 0, sign);
    for (let slice = 0; slice <= slices; slice++) {
      const angle = slice * Math.PI * 2 / slices;
      positions.push(Math.cos(angle), Math.sin(angle), sign * 0.5); normals.push(0, 0, sign);
      if (slice < slices) indices.push(center, center + slice + (sign > 0 ? 1 : 2), center + slice + (sign > 0 ? 2 : 1));
    }
  }
  return { positions, normals, indices };
}

export function createSceneRenderer(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new Error('A canvas is required for the 3D range.');
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance' }); }
  catch { throw new Error('WebGL could not start. Check browser hardware acceleration and retry.'); }
  if (!gl) throw new Error('WebGL is unavailable. Enable browser hardware acceleration and retry.');
  const resources = { shaders: [], programs: [], buffers: [] };
  let disposed = false, lost = false;
  const contextLost = (event) => { event.preventDefault(); lost = true; };
  canvas.addEventListener?.('webglcontextlost', contextLost);
  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener?.('webglcontextlost', contextLost);
    for (const buffer of resources.buffers) gl.deleteBuffer(buffer);
    for (const program of resources.programs) gl.deleteProgram(program);
    for (const shader of resources.shaders) gl.deleteShader(shader);
  }
  function shader(type, source) {
    const value = gl.createShader(type);
    if (!value) throw new Error('WebGL could not allocate a range shader.');
    resources.shaders.push(value);
    gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(`3D range shader failed: ${gl.getShaderInfoLog(value) || 'unknown graphics error'}`);
    return value;
  }
  function buffer(type, values) {
    const value = gl.createBuffer();
    if (!value) throw new Error('WebGL could not allocate the range geometry.');
    resources.buffers.push(value);
    gl.bindBuffer(type, value); gl.bufferData(type, values, gl.STATIC_DRAW);
    return value;
  }
  function mesh(data) {
    return {
      position: buffer(gl.ARRAY_BUFFER, new Float32Array(data.positions)),
      normal: buffer(gl.ARRAY_BUFFER, new Float32Array(data.normals)),
      indices: buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices)),
      count: data.indices.length,
    };
  }
  try {
    const vertex = shader(gl.VERTEX_SHADER, SCENE_VERTEX), fragment = shader(gl.FRAGMENT_SHADER, SCENE_FRAGMENT);
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL could not allocate the range program.');
    resources.programs.push(program);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`3D range program failed: ${gl.getProgramInfoLog(program) || 'unknown graphics error'}`);
    const uniforms = {};
    for (const name of ['Projection', 'View', 'Model', 'Normal', 'Color', 'Eye', 'Grid', 'Gloss', 'Emission', 'Fog']) uniforms[name] = gl.getUniformLocation(program, `u${name}`);
    const positionAttribute = gl.getAttribLocation(program, 'aPosition'), normalAttribute = gl.getAttribLocation(program, 'aNormal');
    const cube = mesh(sceneCubeData()), sphere = mesh(sceneSphereData()), cylinder = mesh(sceneCylinderData());
    const identity = sceneIdentity();
    let activeMesh = null;
    function draw(geometry, model, color, { grid = 0, gloss = 0, emission = 0, fog = 1 } = {}) {
      if (geometry !== activeMesh) {
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.position); gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normal); gl.vertexAttribPointer(normalAttribute, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indices); activeMesh = geometry;
      }
      // Models have orthogonal axes: inverse-transpose is each axis / its squared length.
      const normal = new Float32Array(9);
      for (let column = 0; column < 3; column++) {
        const start = column * 4;
        const lengthSquared = model[start] ** 2 + model[start + 1] ** 2 + model[start + 2] ** 2;
        for (let row = 0; row < 3; row++) normal[column * 3 + row] = model[start + row] / lengthSquared;
      }
      gl.uniformMatrix4fv(uniforms.Model, false, model); gl.uniformMatrix3fv(uniforms.Normal, false, normal);
      gl.uniform3fv(uniforms.Color, color);
      gl.uniform1f(uniforms.Grid, grid); gl.uniform1f(uniforms.Gloss, gloss);
      gl.uniform1f(uniforms.Emission, emission); gl.uniform1f(uniforms.Fog, fog);
      gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_SHORT, 0);
    }
    const box = (position, size, color, material, rotation) => draw(cube, sceneModel(position, size, rotation), color, material);
    function render(state = {}) {
      if (disposed || lost || gl.isContextLost()) return;
      const ratio = sceneClamp(sceneFinite(globalThis.devicePixelRatio, 1), 1, 1.5);
      const width = Math.max(1, Math.round(sceneFinite(canvas.clientWidth, canvas.width || 1) * ratio));
      const height = Math.max(1, Math.round(sceneFinite(canvas.clientHeight, canvas.height || 1) * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0.52, 0.56, 0.60, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND); gl.useProgram(program);
      gl.enableVertexAttribArray(positionAttribute); gl.enableVertexAttribArray(normalAttribute);
      activeMesh = null;
      gl.uniformMatrix4fv(uniforms.Projection, false, scenePerspective(sceneClamp(sceneFinite(state.fov, 72), 35, 115), width / height));
      gl.uniformMatrix4fv(uniforms.View, false, sceneView(state.yaw, state.pitch));
      gl.uniform3fv(uniforms.Eye, [0, 0, 0]);
      const grid = { grid: 1, gloss: 0.015 };
      // The full normalized target sequence fits above this floor, including large spheres.
      const wallHeight = 7 - SCENE_FLOOR_Y, wallCenter = (7 + SCENE_FLOOR_Y) / 2;
      box([0, SCENE_FLOOR_Y - 0.08, -4], [28.2, 0.16, 32.2], [0.49, 0.53, 0.57], grid);
      box([0, wallCenter, -18.08], [28.2, wallHeight, 0.16], [0.64, 0.67, 0.70], grid);
      box([-14.08, wallCenter, -4], [0.16, wallHeight, 28], [0.59, 0.63, 0.67], grid);
      box([14.08, wallCenter, -4], [0.16, wallHeight, 28], [0.59, 0.63, 0.67], grid);
      box([0, 7.08, -4], [28.2, 0.16, 28], [0.69, 0.71, 0.73], { grid: 0.6 });
      box([0, wallCenter, 10.08], [28.2, wallHeight, 0.16], [0.61, 0.65, 0.68], grid);
      // Recessed skirting and overhead lights add depth without visual clutter.
      box([0, SCENE_FLOOR_Y + 0.14, -17.96], [28, 0.26, 0.08], [0.39, 0.44, 0.49]);
      for (const side of [-1, 1]) {
        box([side * 13.96, SCENE_FLOOR_Y + 0.14, -4], [0.08, 0.26, 28], [0.39, 0.44, 0.49]);
        box([side * 13.90, wallCenter, -17.9], [0.16, wallHeight, 0.16], [0.49, 0.54, 0.58]);
        for (const z of [-14, -6, 2]) {
          box([side * 5.4, 6.96, z], [3.7, 0.04, 0.48], [0.77, 0.80, 0.81], { emission: 1 });
        }
      }
      const now = sceneFinite(state.now, globalThis.performance?.now?.() ?? 0);
      const hitAge = now - sceneFinite(state.hitAt, -Infinity);
      const hitLight = state.effects !== false && state.hitAt > 0 && hitAge >= 0 && hitAge < 140 ? (1 - hitAge / 140) * 0.04 : 0;
      for (const target of Array.isArray(state.targets) ? state.targets : []) {
        if (!sceneValidTarget(target)) continue;
        const r = target.radius;
        draw(sphere, sceneModel([target.x, SCENE_FLOOR_Y + 0.008, target.z], [r * 0.78, 0.007, r * 0.65]), [0.35, 0.40, 0.44]);
        draw(sphere, sceneModel([target.x, target.y, target.z], [r, r, r]), [0.035 + hitLight, 0.72 + hitLight, 0.82 + hitLight], { gloss: 0.5 });
      }
      if (state.gun !== false) drawGun(state, now, width / height);
    }
    function drawGun(state, now, aspect) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uniforms.Projection, false, scenePerspective(60, aspect));
      gl.uniformMatrix4fv(uniforms.View, false, identity);
      const age = now - sceneFinite(state.shotAt, -Infinity);
      const fired = state.shotAt > 0 && age >= 0;
      const recoil = fired && state.effects !== false && !state.reducedMotion ? Math.exp(-age / 70) : 0;
      const sway = state.reducedMotion ? 0 : Math.sin(now * 0.0018) * 0.002;
      const group = sceneModel([0.46 * Math.min(1, aspect / 1.25), -0.43 + sway + recoil * 0.025, -0.94 + recoil * 0.06], [1, 1, 1], [0.04 + recoil * 0.12, 0.16, -0.065]);
      const metal = [0.17, 0.20, 0.23], frame = [0.105, 0.125, 0.15], edge = [0.25, 0.29, 0.32];
      const part = (geometry, position, scale, color, rotation, emission = 0) => draw(geometry, sceneMultiply(group, sceneModel(position, scale, rotation)), color, { gloss: 0.28, emission, fog: 0 });
      const gunBox = (position, size, color = metal, rotation) => part(cube, position, size, color, rotation);
      // The gloved hand is behind the receiver; the slide, sights and bore are geometry.
      part(sphere, [0.03, -0.16, 0.10], [0.105, 0.19, 0.115], [0.18, 0.20, 0.21], [-0.2, 0, -0.1]);
      part(sphere, [0.11, -0.40, 0.24], [0.12, 0.25, 0.18], [0.13, 0.16, 0.18], [-0.3, 0, -0.2]);
      gunBox([0, -0.14, 0.015], [0.15, 0.34, 0.20], frame, [-0.24, 0, 0]);
      gunBox([0, -0.305, 0.055], [0.17, 0.035, 0.22], [0.075, 0.09, 0.105], [-0.24, 0, 0]);
      gunBox([0, -0.005, -0.19], [0.17, 0.13, 0.53], frame);
      gunBox([0, 0.115, -0.21], [0.18, 0.15, 0.64]);
      gunBox([0, 0.194, -0.21], [0.15, 0.012, 0.60], edge);
      gunBox([0.092, 0.12, -0.25], [0.006, 0.065, 0.16], [0.29, 0.32, 0.34]);
      part(cylinder, [0, 0.105, -0.558], [0.058, 0.058, 0.075], [0.27, 0.30, 0.32]);
      part(cylinder, [0, 0.105, -0.598], [0.038, 0.038, 0.006], [0.025, 0.032, 0.04]);
      gunBox([0, -0.17, -0.23], [0.13, 0.03, 0.25], frame);
      gunBox([0, -0.105, -0.345], [0.13, 0.14, 0.033], frame, [0.12, 0, 0]);
      gunBox([0, -0.085, -0.18], [0.025, 0.10, 0.025], [0.29, 0.31, 0.33], [-0.24, 0, 0]);
      for (let i = 0; i < 6; i++) {
        gunBox([0.092, 0.115, 0.07 - i * 0.025], [0.006, 0.105, 0.008], [0.08, 0.10, 0.12]);
        gunBox([0.078, -0.085 - i * 0.03, 0.04 + i * 0.007], [0.008, 0.012, 0.14], [0.075, 0.09, 0.105], [-0.24, 0, 0]);
      }
      for (const side of [-1, 1]) gunBox([side * 0.055, 0.22, 0.055], [0.028, 0.04, 0.045], [0.055, 0.07, 0.08]);
      gunBox([0, 0.222, -0.47], [0.025, 0.045, 0.03], [0.06, 0.075, 0.085]);
      gunBox([0, 0.224, -0.452], [0.009, 0.018, 0.006], [0.74, 0.81, 0.78]);
      if (fired && age < 45 && state.effects !== false) {
        part(sphere, [0, 0.105, -0.69], [0.045, 0.045, 0.13], [1, 0.64, 0.19], undefined, 1.5);
        part(sphere, [0, 0.105, -0.65], [0.028, 0.028, 0.07], [1, 0.94, 0.72], undefined, 1.1);
      }
    }
    return { render, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
