// Self-contained presentation layer; this module never changes drill scores or hitboxes.
export const FEEL_KEY = 'aim-trainer:feel:v1';
export const FEEL_DEFAULTS = Object.freeze({ sound: false, crosshair: 'cross', gun: true, effects: true });

export function validateFeelConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    sound: typeof source.sound === 'boolean' ? source.sound : false,
    crosshair: ['cross', 'dot', 'ring'].includes(source.crosshair) ? source.crosshair : 'cross',
    gun: typeof source.gun === 'boolean' ? source.gun : true,
    effects: typeof source.effects === 'boolean' ? source.effects : true,
  };
}

export function readFeelConfig(storage) {
  try { return validateFeelConfig(JSON.parse(storage.getItem(FEEL_KEY))); }
  catch { return { ...FEEL_DEFAULTS }; }
}

export function saveFeelConfig(storage, value) {
  try { storage.setItem(FEEL_KEY, JSON.stringify(validateFeelConfig(value))); return true; }
  catch { return false; }
}

// Border widths are excluded so the rendered reticle agrees with the native cursor.
export function feelPoint(clientX, clientY, rect, borderX = 0, borderY = 0) {
  const width = Math.max(0, Number(rect.width) - borderX * 2) || 0;
  const height = Math.max(0, Number(rect.height) - borderY * 2) || 0;
  const x = Number.isFinite(clientX) ? Math.max(0, Math.min(width, clientX - rect.left - borderX)) : width / 2;
  const y = Number.isFinite(clientY) ? Math.max(0, Math.min(height, clientY - rect.top - borderY)) : height / 2;
  return { x, y, swayX: width ? (x / width - .5) * 12 : 0, swayY: height ? (y / height - .5) * 7 : 0 };
}

export const FEEL_CSS = `
.at-feel-arena { isolation:isolate; }
.at-feel-arena .at-target { z-index:2; }
.at-feel-arena .at-count,.at-feel-arena .at-flag { z-index:6; }
.at-feel-arena.at-feel-active,.at-feel-arena.at-feel-active .at-target { cursor:none; }
.at-feel-layer { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:3; }
.at-feel-layer *,.at-feel-depth,.at-feel-gun { pointer-events:none; }
.at-feel-depth { position:absolute; inset:55% -30% -20%; z-index:0; opacity:.25; transform:perspective(180px) rotateX(52deg); transform-origin:center top; background-image:linear-gradient(#1f5660 1px,transparent 1px),linear-gradient(90deg,#1f5660 1px,transparent 1px); background-size:42px 38px; }
.at-feel-reticle { position:absolute; width:22px; height:22px; transform:translate(-50%,-50%); filter:drop-shadow(0 1px 1px #000); color:#d6fff7; }
.at-feel-reticle.cross::before,.at-feel-reticle.cross::after { content:''; position:absolute; background:currentColor; }
.at-feel-reticle.cross::before { left:10px; top:1px; width:2px; height:20px; }
.at-feel-reticle.cross::after { top:10px; left:1px; height:2px; width:20px; }
.at-feel-reticle.dot { width:5px; height:5px; border-radius:50%; background:#d6fff7; box-shadow:0 0 0 1px #071519; }
.at-feel-reticle.ring { width:18px; height:18px; box-sizing:border-box; border:2px solid currentColor; border-radius:50%; }
.at-feel-gun { position:absolute; right:4%; bottom:-9px; width:clamp(120px,30%,180px); z-index:1; opacity:.7; transform-origin:80% 100%; }
.at-feel-gun svg { display:block; width:100%; height:auto; overflow:visible; }
.at-feel-recoil { animation:at-feel-kick .16s ease-out; transform-origin:80% 100%; }
.at-feel-flash { fill:#fff5c5; stroke:#ffba59; stroke-width:3; }
.at-feel-impact { position:absolute; width:22px; height:22px; margin:-11px; border:2px solid #c8fff0; border-radius:50%; box-sizing:border-box; animation:at-feel-impact .4s ease-out forwards; }
.at-feel-particle { position:absolute; width:3px; height:3px; border-radius:50%; background:#a8ffe4; animation:at-feel-spark .4s ease-out forwards; }
.at-feel-plus { position:absolute; margin:-27px 0 0 10px; color:#b4ffe4; font:800 14px/1 sans-serif; text-shadow:0 1px 3px #000; animation:at-feel-score .45s ease-out forwards; }
.at-feel-controls { display:flex; flex-shrink:0; align-items:center; flex-wrap:wrap; gap:8px 14px; padding:9px 14px; color:var(--dsw-alias-label-secondary); font-family:inherit; font-size:11px; line-height:1.4; }
.at-feel-controls label { display:inline-flex; gap:5px; align-items:center; cursor:pointer; }
.at-feel-controls input { accent-color:#00e5c0; margin:0; }
.at-feel-controls select { min-height:28px; max-width:130px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; }
.at-feel-controls :focus-visible { outline:2px solid #00e5c0; outline-offset:3px; }
@keyframes at-feel-kick { 0% { transform:translate(4px,9px) rotate(5deg); } 100% { transform:none; } }
@keyframes at-feel-impact { to { transform:scale(1.9); opacity:0; } }
@keyframes at-feel-spark { to { transform:translate(var(--fx),var(--fy)); opacity:0; } }
@keyframes at-feel-score { to { transform:translateY(-24px); opacity:0; } }
@media (prefers-reduced-motion:reduce) {
 .at-feel-recoil { animation:none; }
 .at-feel-impact,.at-feel-particle { display:none; }
 .at-feel-plus { animation:none; }
 .at-feel-gun { transform:none !important; }
}
`;

export function createFeel(React) {
  const fh = React.createElement;
  const listeners = new Set();
  let settings;
  function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
  function current() { if (!settings) settings = readFeelConfig(storage()); return settings; }
  function update(patch) {
    settings = validateFeelConfig({ ...current(), ...patch });
    saveFeelConfig(storage(), settings);
    for (const notify of listeners) notify(settings);
  }
  function useFeel() {
    const [value, setValue] = React.useState(current);
    React.useEffect(() => {
      listeners.add(setValue);
      setValue(current());
      return () => { listeners.delete(setValue); };
    }, []);
    return value;
  }

  function FeelControls({ t }) {
    const config = useFeel();
    const toggle = (key, label) => fh('label', { key },
      fh('input', { type: 'checkbox', checked: config[key], onChange: (e) => update({ [key]: e.target.checked }) }), t(label));
    return fh('div', { className: 'at-feel-controls' },
      toggle('sound', 'feelSound'),
      fh('label', null, t('feelCrosshair'),
        fh('select', { value: config.crosshair, onChange: (e) => update({ crosshair: e.target.value }) },
          ...[['cross', 'feelCross'], ['dot', 'feelDot'], ['ring', 'feelRing']].map(([value, key]) => fh('option', { key: value, value }, t(key))))),
      toggle('gun', 'feelGun'), toggle('effects', 'feelEffects'));
  }

  function Arena({ active = false, t, divRef, children, className = '', onPointerMove, onPointerLeave, onPointerUp, onPointerCancel, onPointerDownCapture, ...props }) {
    const config = useFeel();
    const [pointer, setPointer] = React.useState(null);
    const [impacts, setImpacts] = React.useState([]);
    const [shot, setShot] = React.useState(0);
    const [flash, setFlash] = React.useState(false);
    const seq = React.useRef(0);
    const flashTimer = React.useRef(null);
    const sound = React.useRef(null);
    const lastSound = React.useRef(0);
    React.useEffect(() => {
      if (!impacts.length) return undefined;
      const timer = setTimeout(() => setImpacts([]), 460);
      return () => clearTimeout(timer);
    }, [impacts]);
    React.useEffect(() => {
      if (!active) { setPointer(null); setImpacts([]); setFlash(false); clearTimeout(flashTimer.current); }
    }, [active]);
    React.useEffect(() => () => {
      clearTimeout(flashTimer.current);
      if (sound.current) { try { sound.current.close()?.catch(() => {}); } catch { /* browser already closed */ } }
    }, []);

    function point(event) {
      const node = event.currentTarget;
      return feelPoint(event.clientX, event.clientY, node.getBoundingClientRect(), node.clientLeft || 0, node.clientTop || 0);
    }
    // Only invoked synchronously from pointer-down; no autoplay or network audio.
    function play(hit, event) {
      if (!config.sound || event.nativeEvent?.isTrusted === false || event.isTrusted === false) return;
      const now = Date.now();
      if (now - lastSound.current < 35) return;
      lastSound.current = now;
      try {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return;
        if (!sound.current || sound.current.state === 'closed') sound.current = new Audio();
        const context = sound.current;
        if (context.state === 'suspended') context.resume()?.catch(() => {});
        const start = context.currentTime;
        function tone(type, from, to, gain, delay, duration) {
          const osc = context.createOscillator();
          const envelope = context.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(from, start + delay);
          osc.frequency.exponentialRampToValueAtTime(to, start + delay + duration);
          envelope.gain.setValueAtTime(gain, start + delay);
          envelope.gain.exponentialRampToValueAtTime(.0001, start + delay + duration);
          osc.connect(envelope); envelope.connect(context.destination);
          osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
          osc.start(start + delay); osc.stop(start + delay + duration);
        }
        tone('triangle', 170, 45, .09, 0, .1);
        tone('sawtooth', 900, 110, .025, 0, .045);
        if (hit) tone('sine', 1100, 1800, .045, .025, .11);
      } catch { /* Audio unavailable: visuals and scoring still work. */ }
    }
    function capture(event) {
      if (active && (event.button === undefined || event.button === 0)) {
        const p = point(event);
        setPointer(p);
        const target = event.target?.closest?.('.at-target');
        const hit = !!target && event.currentTarget.contains(target);
        play(hit, event);
        if (config.gun) {
          setShot(++seq.current); setFlash(true);
          clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(false), 70);
        }
        if (config.effects && hit) {
          const id = ++seq.current;
          setImpacts((items) => [...items.slice(-5), { ...p, id }]);
        }
      }
      if (onPointerDownCapture) onPointerDownCapture(event);
    }
    function gun() {
      // Original vector pistol design, drawn here; no downloaded models or assets.
      return fh('div', { className: 'at-feel-gun', 'aria-hidden': true, style: { transform: `translate(${pointer?.swayX || 0}px,${pointer?.swayY || 0}px)` } },
        fh('div', { key: shot, className: shot ? 'at-feel-recoil' : '' },
          fh('svg', { viewBox: '0 0 200 165', focusable: 'false' },
            fh('path', { d: 'M116 83 L166 92 L190 165 L134 165 L108 112 Z', fill: '#111d29', stroke: '#506674', strokeWidth: 3 }),
            fh('path', { d: 'M49 56 L128 36 L165 55 L162 88 L103 108 L64 91 Z', fill: '#263947', stroke: '#7d97a1', strokeWidth: 3 }),
            fh('path', { d: 'M46 53 L127 33 L155 44 L78 69 L46 66 Z', fill: '#45616c', stroke: '#8ba4ae', strokeWidth: 2 }),
            fh('path', { d: 'M49 53 L72 62 L73 77 L49 68 Z', fill: '#07121a', stroke: '#a2b9be', strokeWidth: 2 }),
            fh('path', { d: 'M84 74 L141 55 M116 121 L155 136 M121 134 L161 149', stroke: '#00e5c0', strokeWidth: 3, opacity: .8 }),
            fh('path', { d: 'M88 101 Q78 122 111 124 L126 111', fill: 'none', stroke: '#5b7480', strokeWidth: 5 }),
            fh('path', { d: 'M117 32 L121 22 L132 25 L133 32', fill: '#13212c', stroke: '#00e5c0', strokeWidth: 2 }),
            flash && fh('path', { className: 'at-feel-flash', d: 'M48 57 L24 37 L29 53 L7 55 L29 65 L20 79 L49 66 Z' }))));
    }
    return fh('div', {
      ...props, ref: divRef, className: `${className} at-feel-arena${active && pointer ? ' at-feel-active' : ''}`,
      onPointerDownCapture: capture,
      onPointerMove: (event) => { if (active) setPointer(point(event)); if (onPointerMove) onPointerMove(event); },
      onPointerLeave: (event) => { setPointer(null); if (onPointerLeave) onPointerLeave(event); },
      onPointerUp: (event) => { if (event.pointerType === 'touch') setPointer(null); if (onPointerUp) onPointerUp(event); },
      onPointerCancel: (event) => { setPointer(null); if (onPointerCancel) onPointerCancel(event); },
    }, children,
    active && fh('div', { className: 'at-feel-depth', 'aria-hidden': true }),
    active && config.gun && gun(),
    active && fh('div', { className: 'at-feel-layer', 'aria-hidden': true },
      pointer && fh('span', { className: `at-feel-reticle ${config.crosshair}`, style: { left: pointer.x, top: pointer.y } }),
      config.effects && impacts.map((item) => fh('div', { key: item.id },
        fh('span', { className: 'at-feel-impact', style: { left: item.x, top: item.y } }),
        fh('span', { className: 'at-feel-plus', style: { left: item.x, top: item.y } }, '+1'),
        ...Array.from({ length: 6 }, (_, i) => fh('span', { key: i, className: 'at-feel-particle', style: {
          left: item.x, top: item.y, '--fx': `${Math.cos(i * Math.PI / 3) * 30}px`, '--fy': `${Math.sin(i * Math.PI / 3) * 30}px`,
        } }))))));
  }
  return { Arena, FeelControls };
}
