import { aimTarget, rotateLook, createSceneRenderer, sceneTarget } from './scene3d.js';
import { DrillSession, rangeSettings, readRangeStorage, writeRangeStorage, readRunHistory, recordRun, bestRunScore, RANGE_SETTINGS_KEY, RANGE_HISTORY_KEY, RANGE_RECORDS_KEY, RANGE_GHOST_KEY } from './range.js';
import { validGhost, ghostScoreAt } from './ghost.js';

export function createRange(React) {
  const el = React.createElement;
  const listeners = new Set();
  let preferences;
  const currentSettings = () => preferences || (preferences = rangeSettings(readRangeStorage(RANGE_SETTINGS_KEY, {})));
  function useSettings() {
    const [settings, setSettings] = React.useState(currentSettings);
    React.useEffect(() => { listeners.add(setSettings); return () => listeners.delete(setSettings); }, []);
    return settings;
  }
  function updateSettings(patch) {
    preferences = rangeSettings({ ...currentSettings(), ...patch });
    writeRangeStorage(RANGE_SETTINGS_KEY, preferences);
    for (const notify of listeners) notify(preferences);
  }
  function RangeSettings({ t }) {
    const settings = useSettings();
    const slider = (key, label, min, max, step, unit = '') => el('label', { className: 'ar-setting' },
      el('span', null, t(label)), el('strong', null, `${settings[key]}${unit}`),
      el('input', { type: 'range', min, max, step, value: settings[key], 'aria-label': t(label), onChange: event => updateSettings({ [key]: Number(event.target.value) }) }));
    return el('div', { className: 'ar-settings' },
      el('div', { className: 'ar-section-label' }, t('settingsControls')),
      slider('sensitivity', 'sensitivity', .02, .6, .01, ' °/px'),
      slider('fov', 'fieldOfView', 60, 110, 1, '°'),
      el('label', { className: 'ar-setting' }, el('span', null, t('feelCrosshair')),
        el('select', { value: settings.crosshair, onChange: event => updateSettings({ crosshair: event.target.value }) },
          ...[['cross', 'feelCross'], ['dot', 'feelDot'], ['ring', 'feelRing']].map(([key, label]) => el('option', { key, value: key }, t(label))))),
      el('div', { className: 'ar-section-label' }, t('settingsPresentation')),
      ...[['gun', 'feelGun'], ['effects', 'feelEffects'], ['sound', 'feelSound'], ['ghost', 'ghost']].map(([key, label]) => el('label', { key, className: 'ar-toggle' },
        el('span', null, t(label)), el('input', { type: 'checkbox', checked: settings[key], onChange: event => updateSettings({ [key]: event.target.checked }) }))),
      el('p', { className: 'ar-muted' }, t('sensitivityHint')));
  }

  function Trend({ values, label }) {
    if (!values.length) return el('div', { className: 'ar-chart-empty' }, '—');
    const max = Math.max(1, ...values), min = Math.min(0, ...values);
    const points = values.map((value, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${48 - (value - min) / Math.max(1, max - min) * 40}`).join(' ');
    return el('svg', { className: 'ar-trend', viewBox: '0 0 100 52', preserveAspectRatio: 'none', role: 'img', 'aria-label': label },
      ...[12, 28, 44].map(y => el('line', { key: y, x1: 0, x2: 100, y1: y, y2: y, stroke: '#30383d', strokeWidth: .4 })),
      el('polyline', { points, fill: 'none', stroke: '#4cd4d9', strokeWidth: 1.4, vectorEffect: 'non-scaling-stroke' }),
      values.length === 1 && el('circle', { cx: 50, cy: 8, r: 1.8, fill: '#4cd4d9' }));
  }

  function RangeRecords({ t }) {
    const history = readRunHistory();
    const records = readRangeStorage(RANGE_RECORDS_KEY, null);
    const legacy = readRangeStorage('aim-trainer:records:v1', null);
    return el('div', { className: 'ar-record-page' },
      el('div', { className: 'ar-page-heading' }, el('span', { className: 'ar-eyebrow' }, 'YOUR PERFORMANCE'), el('h2', null, t('recordTab')), el('p', null, t('historyHint'))),
      el('div', { className: 'ar-record-grid' }, ...['click', 'reaction', 'track'].map(mode => {
        const runs = history.filter(run => run.mode === mode);
        const best = bestRunScore(mode, records, runs) ?? '—';
        return el('article', { key: mode, className: 'ar-panel' }, el('span', { className: 'ar-eyebrow' }, t(mode)),
          el('strong', { className: 'ar-best-number' }, best, el('small', null, mode === 'reaction' ? ' ms' : mode === 'track' ? '%' : '')),
          el(Trend, { values: runs.slice(-20).map(r => r.score), label: t('recentRuns') }), el('p', { className: 'ar-muted' }, `${runs.length} ${t('completedRuns')}`));
      })),
      history.length ? el('div', { className: 'ar-panel ar-history' }, el('h3', null, t('recentRuns')),
        el('table', null, el('thead', null, el('tr', null, ...['trainingTask', 'score', 'accuracy', 'date'].map(key => el('th', { key }, t(key))))),
          el('tbody', null, ...history.slice(-15).reverse().map((run, i) => el('tr', { key: i },
            el('td', null, t(run.mode)), el('td', null, run.score, run.mode === 'reaction' ? ' ms' : run.mode === 'track' ? '%' : ''),
            el('td', null, `${run.accuracy}%`), el('td', null, new Date(run.finishedAt).toLocaleString()))))))
        : el('div', { className: 'ar-panel ar-empty-records' }, el('span', null, '◎'), el('h3', null, t('noRecord')), el('p', null, t('historyHint'))),
      legacy && el('div', { className: 'ar-legacy' }, t('legacyRecords'), ' · ', ...['click', 'reaction', 'track'].map(mode => `${t(mode)}: ${Number.isFinite(legacy[mode]) ? legacy[mode] : '—'}  `)));
  }

  function RangeGame({ mode = 'click', t, onFinish = () => {}, visible = true, seed, multiplayer = false, durationMs, rounds = 8, startLocal = 0, onProgress, onBack, onLeave, statusPanel }) {
    const settings = useSettings();
    const configRef = React.useRef(settings); configRef.current = settings;
    const makeGame = () => new DrillSession({ mode, seed, multiplayer, durationMs, rounds });
    const session = React.useRef(null);
    if (!session.current) {
      session.current = makeGame();
      if (multiplayer) session.current.start(startLocal || Date.now(), { skipCountdown: true });
    }
    const [view, setView] = React.useState(() => session.current.snapshot());
    const [locked, setLocked] = React.useState(false);
    const [error, setError] = React.useState('');
    const [result, setResult] = React.useState(null);
    const [ghost, setGhost] = React.useState(() => {
      const data = readRangeStorage(RANGE_GHOST_KEY, null);
      return validGhost(data, 30000) ? data : null;
    });
    const canvasRef = React.useRef(null);
    const controlRef = React.useRef(null);
    const visibleRef = React.useRef(visible); visibleRef.current = visible;
    const callbacks = React.useRef({ onFinish, onProgress }); callbacks.current = { onFinish, onProgress };
    const camera = React.useRef({ yaw: 0, pitch: 0 });
    const history = readRunHistory().filter(run => run.mode === mode);
    const active = !['ready', 'done'].includes(view.status);
    const running = view.status === 'running' || view.status === 'countdown';
    const clock = () => multiplayer ? Date.now() : performance.now();

    React.useEffect(() => {
      if (!visible) {
        controlRef.current?.suspendGraphics();
        session.current.pause(clock());
        setView(session.current.snapshot());
        if (document.pointerLockElement === canvasRef.current && canvasRef.current) document.exitPointerLock?.();
      } else controlRef.current?.resumeGraphics();
    }, [visible]);

    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      let renderer = null, rendererAvailable = true, frame = 0, disposed = false, lastUI = 0, lastReport = 0, reportedDone = false;
      let lastRender = -1000, requested = false;
      let shotAt = -1000, hitAt = -1000, audio = null;
      let wasLocked = false;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
      const suspendGraphics = () => { renderer?.dispose(); renderer = null; };
      const openRenderer = () => {
        if (disposed || renderer || !rendererAvailable || !visibleRef.current || document.hidden) return;
        try { renderer = createSceneRenderer(canvas); setError(''); }
        catch (_) { rendererAvailable = false; setError('webglUnavailable'); }
      };
      openRenderer();
      const sync = () => setView(session.current.snapshot());
      const finish = () => {
        if (reportedDone || session.current.status !== 'done') return;
        reportedDone = true;
        const data = { ...session.current.snapshot(), finishedAt: Date.now() };
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        if (!multiplayer) {
          data.persistence = writeRangeStorage(RANGE_HISTORY_KEY, recordRun(readRunHistory(), data));
          if (mode === 'click' && data.hits > 0) {
            const old = readRangeStorage(RANGE_GHOST_KEY, null);
            if (!validGhost(old, 30000) || session.current.hitTimes.length > old.hits.length) {
              data.ghostPersistence = writeRangeStorage(RANGE_GHOST_KEY, { version: 1, durationMs: 30000, hits: session.current.hitTimes });
            }
          }
          setResult(data);
        }
        callbacks.current.onFinish(mode, data.score, data);
      };
      const playSound = hit => {
        if (!configRef.current.sound) return;
        try {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return;
          if (!audio) audio = new Audio();
          if (audio.state === 'suspended') audio.resume().catch(() => {});
          const oscillator = audio.createOscillator(), gain = audio.createGain();
          oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(hit ? 900 : 180, audio.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(hit ? 330 : 65, audio.currentTime + .07);
          gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .09);
          oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .1);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        } catch (_) { /* Visual training remains usable without audio. */ }
      };
      const lockChange = () => {
        if (disposed) return;
        const input = document.pointerLockElement === canvas;
        setLocked(input);
        if (input) {
          setError('');
          if (session.current.status === 'ready') session.current.start(clock());
          else session.current.resume(clock());
        } else if (wasLocked) session.current.pause(clock());
        wasLocked = input;
        sync();
      };
      const move = event => {
        if (document.pointerLockElement !== canvas || !visibleRef.current) return;
        camera.current = rotateLook(camera.current, event.movementX, event.movementY, configRef.current.sensitivity);
      };
      const fire = event => {
        if (event.button !== 0 || document.pointerLockElement !== canvas || !visibleRef.current || session.current.status !== 'running') return;
        event.preventDefault();
        const target = aimTarget(camera.current, session.current.targets);
        const hit = session.current.shoot(clock(), target?.id);
        shotAt = performance.now(); if (hit) hitAt = shotAt;
        playSound(hit); sync(); finish();
      };
      const hidden = () => {
        if (!document.hidden) { openRenderer(); return; }
        suspendGraphics();
        session.current.pause(clock()); sync();
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      };
      const contextLost = event => {
        event.preventDefault(); session.current.pause(clock()); sync();
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        suspendGraphics(); rendererAvailable = false; setError('webglLost');
      };
      const restore = () => { rendererAvailable = true; openRenderer(); };
      const lockError = () => { if (requested) { requested = false; setError('pointerLockFailed'); } };
      const animate = now => {
        if (disposed) return;
        const game = session.current;
        const input = document.pointerLockElement === canvas;
        if (!document.hidden && (visibleRef.current || multiplayer)) {
          const aimed = input && visibleRef.current ? aimTarget(camera.current, game.targets) : null;
          game.tick(clock(), aimed?.id);
          if ((game.status === 'running' || game.status === 'countdown') && now - lastUI > 80) { sync(); lastUI = now; }
          if (multiplayer && game.status === 'running' && now - lastReport > 250) {
            callbacks.current.onProgress?.(game.snapshot()); lastReport = now;
          }
          finish();
          if (visibleRef.current && renderer && game.status !== 'done' && (input || now - lastRender > 100)) {
            renderer.render({ ...camera.current, ...configRef.current,
            targets: game.status === 'ready' ? [sceneTarget({ x: .38, y: .42 }, 'p1'), sceneTarget({ x: .6, y: .34 }, 'p2'), sceneTarget({ x: .52, y: .64 }, 'p3')] : game.targets,
            shotAt, hitAt, now, reducedMotion });
            lastRender = now;
          }
        }
        frame = window.requestAnimationFrame(animate);
      };
      controlRef.current = {
        request() { requested = true; },
        suspendGraphics,
        resumeGraphics: openRenderer,
        retry() { suspendGraphics(); rendererAvailable = true; openRenderer(); },
        restart() {
          session.current = makeGame(); reportedDone = false; camera.current = { yaw: 0, pitch: 0 };
          setResult(null); sync();
          const saved = readRangeStorage(RANGE_GHOST_KEY, null); setGhost(validGhost(saved, 30000) ? saved : null);
        },
        abandon() {
          if (document.pointerLockElement === canvas) document.exitPointerLock?.();
          session.current = makeGame(); reportedDone = false; camera.current = { yaw: 0, pitch: 0 }; setResult(null); sync();
        },
      };
      document.addEventListener('pointerlockchange', lockChange);
      document.addEventListener('pointerlockerror', lockError);
      document.addEventListener('mousemove', move);
      document.addEventListener('mousedown', fire);
      document.addEventListener('visibilitychange', hidden);
      canvas.addEventListener('webglcontextlost', contextLost);
      canvas.addEventListener('webglcontextrestored', restore);
      const preventMenu = event => event.preventDefault();
      canvas.addEventListener('contextmenu', preventMenu);
      const onlineTimer = multiplayer ? window.setInterval(() => {
        session.current.tick(clock());
        finish();
      }, 150) : 0;
      frame = window.requestAnimationFrame(animate);
      return () => {
        disposed = true; window.cancelAnimationFrame(frame);
        document.removeEventListener('pointerlockchange', lockChange); document.removeEventListener('pointerlockerror', lockError);
        document.removeEventListener('mousemove', move); document.removeEventListener('mousedown', fire);
        document.removeEventListener('visibilitychange', hidden);
        canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', restore);
        canvas.removeEventListener('contextmenu', preventMenu);
        if (onlineTimer) window.clearInterval(onlineTimer);
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        suspendGraphics(); if (audio) audio.close().catch(() => {});
        controlRef.current = null;
      };
    }, []);

    function enter() {
      if (error === 'webglUnavailable' || error === 'webglLost') return;
      const canvas = canvasRef.current;
      if (!canvas?.requestPointerLock) { setError('pointerLockUnavailable'); return; }
      try {
        controlRef.current?.request();
        const pending = canvas.requestPointerLock();
        pending?.catch?.(() => setError('pointerLockFailed'));
      } catch (_) { setError('pointerLockFailed'); }
    }
    function restart() { controlRef.current?.restart(); }
    const title = t(mode === 'click' ? 'gridshot' : mode === 'reaction' ? 'reactionTask' : 'trackingTask');
    const unit = mode === 'reaction' ? ' ms' : mode === 'track' ? '%' : '';
    const stat = (label, value) => el('div', { className: 'ar-hud-stat', key: label }, el('span', null, t(label)), el('strong', null, value));
    const ghostScore = ghostScoreAt(ghost, view.elapsedMs);
    const overlay = active && (!locked || view.status === 'paused');
    return el('div', { className: `ar-range${active ? ' ar-range-play' : ''}${result ? ' ar-range-result' : ''}`, 'data-active': active ? 'true' : 'false' },
      el('div', { className: 'ar-scene at-arena' },
        el('canvas', { ref: canvasRef, className: 'ar-canvas', 'aria-label': t('sceneLabel') }),
        !active && !result && el('div', { className: 'ar-hero-text' }, el('span', { className: 'ar-eyebrow' }, 'AIM TRAINER / PRECISION SERIES'), el('h1', null, title), el('p', null, t(`${mode}Hint3d`))),
        !active && !result && el('span', { className: 'ar-scene-badge' }, '● 3D RANGE'),
        active && el('div', { className: 'ar-hud' },
          el('div', { className: 'ar-hud-name' }, el('strong', null, title), el('span', null, multiplayer ? t('versusTab') : 'AIM TRAINER')),
          stat('score', `${view.score}${unit}`), stat(mode === 'reaction' ? 'round' : 'timeLeft', mode === 'reaction' ? `${view.round}/${rounds}` : `${Math.ceil(view.leftMs / 1000)}s`), stat('accuracy', `${view.accuracy}%`),
          el('button', { className: 'ar-hud-pause', type: 'button', onClick: () => document.exitPointerLock?.(), 'aria-label': t('pause') }, 'Ⅱ')),
        active && multiplayer && statusPanel && el('div', { className: 'ar-online-progress' }, statusPanel),
        active && !overlay && el('div', { className: `ar-crosshair ${settings.crosshair}`, 'aria-hidden': true }),
        view.status === 'countdown' && locked && el('div', { className: 'ar-countdown' }, el('span', null, t('ready')), el('strong', null, view.countdown)),
        mode === 'reaction' && active && locked && view.status === 'running' && !session.current.targets.length && el('div', { className: 'ar-reaction-wait' }, view.early ? t('early') : t('waitForTarget')),
        mode === 'click' && active && settings.ghost && ghost && !multiplayer && el('div', { className: 'ar-ghost-strip' },
          el('span', null, t('ghost')), el('strong', null, `${view.hits} : ${ghostScore}`),
          el('span', null, `${view.hits - ghostScore >= 0 ? '+' : ''}${view.hits - ghostScore}`)),
        active && locked && el('div', { className: 'ar-game-help' }, t('escapePause')),
        overlay && el('div', { className: 'ar-pause-overlay' },
          el('div', { className: 'ar-pause-card' }, el('span', { className: 'ar-eyebrow' }, title),
            el('h2', null, t(multiplayer ? 'inputReleased' : 'paused')),
            el('p', null, t(multiplayer ? 'onlineClockContinues' : 'pauseHint')),
            error && el('p', { className: 'ar-error', role: 'alert' }, t(error)),
            (error === 'webglUnavailable' || error === 'webglLost') && el('button', { className: 'ar-secondary', type: 'button', onClick: () => controlRef.current?.retry() }, t('retryGraphics')),
            el('button', { className: 'at-primary', type: 'button', onClick: enter }, t('resumeTraining')),
            multiplayer && el('button', { className: 'ar-secondary', type: 'button', onClick: onLeave }, t('leaveRoom')),
            !multiplayer && el('button', { className: 'ar-secondary', type: 'button', onClick: () => { controlRef.current?.abandon(); onBack?.(); } }, t('backToTasks')))),
        result && el('div', { className: 'ar-results' },
          el('div', { className: 'ar-result-top' }, el('span', { className: 'ar-eyebrow' }, t('sessionComplete')), el('h2', null, title),
            el('div', { className: 'ar-result-score' }, result.score.toLocaleString(), el('small', null, unit || t('hits')))),
          el('div', { className: 'ar-result-stats' }, stat('accuracy', `${result.accuracy}%`),
            stat(mode === 'track' ? 'duration' : 'targetsHit', mode === 'track' ? `${Math.round(result.elapsedMs / 1000)}s` : `${result.hits} / ${result.shots}`),
            stat(mode === 'reaction' ? 'fastestReaction' : mode === 'track' ? 'onTargetTime' : 'averageHitTime', mode === 'track' ? `${(session.current.trackedMs / 1000).toFixed(1)}s` : `${mode === 'reaction' ? Math.round(Math.min(...session.current.times)) : result.averageHitMs} ms`)),
          el('div', { className: 'ar-result-charts' },
            el('div', { className: 'ar-panel' }, el('h3', null, t('sessionTrend')), el(Trend, { values: result.samples, label: t('sessionTrend') })),
            el('div', { className: 'ar-panel' }, el('h3', null, t('recentRuns')), el(Trend, { values: [...history.slice(-9).map(r => r.score)], label: t('recentRuns') }))),
          el('div', { className: 'ar-result-actions' }, el('span', { className: result.persistence ? 'ar-muted' : 'ar-error', role: result.persistence ? undefined : 'alert' }, t(result.persistence ? 'savedLocally' : 'saveFailed')),
            result.ghostPersistence === false && el('span', { className: 'ar-error', role: 'alert' }, t('ghostSaveFailed')),
            el('button', { className: 'ar-secondary', type: 'button', onClick: () => { restart(); onBack?.(); } }, t('backToTasks')),
            el('button', { className: 'at-primary', type: 'button', onClick: () => { restart(); enter(); } }, t('again'))))),
      !active && !result && el('div', { className: 'ar-task-info' },
        el('div', null, el('span', { className: 'ar-eyebrow' }, t('trainingTask')), el('h2', null, title), el('p', null, t('mouseLookHint'))),
        el('div', { className: 'ar-task-duration' }, el('strong', null, mode === 'reaction' ? rounds : mode === 'track' ? '20' : '30'), el('span', null, mode === 'reaction' ? t('round') : t('sec'))),
        el('button', { className: 'at-primary ar-start', type: 'button', 'data-shortcut-start': '', onClick: enter, disabled: error === 'webglUnavailable' || error === 'webglLost' }, t('start'))),
      !active && !result && error && el('p', { className: 'ar-error', role: 'alert' }, t(error)),
      !active && !result && (error === 'webglUnavailable' || error === 'webglLost') && el('button', { className: 'ar-secondary', type: 'button', onClick: () => controlRef.current?.retry() }, t('retryGraphics')),
      !active && !result && el('div', { className: 'ar-task-notes' },
        el('div', { className: 'ar-panel' }, el('span', { className: 'ar-note-icon' }, '⌖'), el('strong', null, t('focusTitle')), el('p', null, t(`${mode}Hint3d`))),
        el('div', { className: 'ar-panel' }, el('span', { className: 'ar-note-icon' }, '↗'), el('strong', null, t('improveTitle')), el('p', null, t('improveHint')))));
  }
  return { RangeGame, RangeSettings, RangeRecords };
}
