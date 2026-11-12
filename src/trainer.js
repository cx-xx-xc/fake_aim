    const h = React.createElement;
    const NS = 'aim-trainer';
    const REC_KEY = RANGE_RECORDS_KEY;
    const POS_KEY = 'aim-trainer:3d:panel:v1';
    const NAME_KEY = 'aim-trainer:name:v1';
    const PID_KEY = 'aim-trainer:player:v1';
    const WIDTH = 1040;
    const HEIGHT = 780;
    const SIZE_KEY = 'aim-trainer:3d:size:v1';
    const { RangeGame, RangeSettings, RangeRecords } = createRange(React);

    const DICTS = {
      en: {
        brandTagline: 'PRECISION TRAINING', settingsTab: 'Settings', settingsHint: 'Tune your controls and the look of your range.',
        trainingLibrary: 'TRAINING LIBRARY', localTraining: 'Your personal range', localTrainingHint: 'Train at your own pace. Completed solo sessions stay in this browser.',
        gridshot: 'GRIDSHOT', reactionTask: 'REFLEX SHOT', trackingTask: 'SPHERE TRACK',
        clickCategory: 'Precision & speed', reactionCategory: 'Reaction & timing', trackCategory: 'Control & consistency',
        clickHint3d: 'Move your view to bring each sphere into the centre crosshair. Left-click to fire. Keep a steady rhythm across all three targets.',
        reactionHint3d: 'Wait for the sphere to appear, then move your view and fire. Only hits count toward your reaction time.',
        trackHint3d: 'Move your view to keep the centre crosshair on the moving sphere. Stay on target for as much of the session as possible.',
        mouseLookHint: 'Mouse to look · Left-click to fire · Esc to pause',
        focusTitle: 'Build control', improveTitle: 'Measure your progress', improveHint: 'Stay precise before increasing speed. Compare your completed sessions in Records.',
        sensitivity: 'Mouse sensitivity', fieldOfView: 'Field of view', settingsControls: 'CONTROLS', settingsPresentation: 'PRESENTATION',
        sensitivityHint: 'Sensitivity is measured in degrees per mouse pixel. These settings are shared by all three tasks and saved in this browser.',
        sceneLabel: 'Three-dimensional aim training range', pause: 'Pause and release mouse', paused: 'Training paused',
        pauseHint: 'Your training clock is paused. Continue to capture the mouse and return to the range.',
        inputReleased: 'Mouse released', onlineClockContinues: 'This is an online match. The match clock keeps running while your mouse is released.',
        resumeTraining: 'Continue training', backToTasks: 'Back to tasks', escapePause: 'ESC  ·  Release mouse / pause', waitForTarget: 'Wait for the target…',
        webglUnavailable: 'This browser could not start WebGL. Enable hardware graphics or try a supported browser, then retry.',
        webglLost: 'The graphics context was lost. Retry graphics to restore the range.',
        pointerLockUnavailable: 'Mouse capture is unavailable here. Open the plugin in a browser that supports Pointer Lock.',
        pointerLockFailed: 'Mouse capture failed. Click Continue or Start again to retry.', retryGraphics: 'Retry graphics',
        sessionComplete: 'SESSION COMPLETE', sessionTrend: 'This session', recentRuns: 'Recent sessions',
        score: 'Score', duration: 'Duration', targetsHit: 'Hits / shots', averageHitTime: 'Average time per hit', onTargetTime: 'Time on target', fastestReaction: 'Fastest reaction',
        savedLocally: 'Saved in this browser', historyHint: 'Complete a training session to build your own performance history.',
        saveFailed: 'Could not save this session. Your browser storage may be full or unavailable.', ghostSaveFailed: 'Could not save the new ghost.',
        completedRuns: 'completed sessions', trainingTask: 'Training task', date: 'Date', legacyRecords: 'Previous 2D records',
        updateTitle: 'Plugin updates', currentVersion: 'Current version', latestVersion: 'Latest on GitHub',
        checkUpdates: 'Check for updates', checkingUpdates: 'Checking…', updateAvailable: 'A newer version is available.',
        updateCurrent: 'You are up to date.', updateAhead: 'This local version is newer than GitHub.',
        updateFailed: 'Check failed. Verify your connection to GitHub and retry.',
        updateSteps: 'Copy the address below. In the Plugins page, remove Aim Trainer, then use Install to install this address. Refresh the page afterwards. All players should update and create a new room.',
        updateCopy: 'Copy installation address', updateCopyFailed: 'Copy failed. Select and copy the address below.',
        updateSource: 'View checked commit', updatePrivacy: 'Checks GitHub only when clicked. Does not install automatically.',
        updateLocalHint: 'Local Git clone: run git pull in its directory instead, then refresh the page.',
        title: 'Aim Trainer', open: 'Open Aim Trainer', close: 'Close',
        center: 'Centre window', drag: 'Drag to move',
        feelSound: 'Sound', feelCrosshair: 'Crosshair', feelGun: 'Weapon view', feelEffects: 'Hit effects',
        feelCross: 'Cross', feelDot: 'Dot', feelRing: 'Ring',
        rangeTitle: 'Precision range', rangeSubtitle: 'Find your rhythm. Make every shot count.',
        shortcuts: 'Space · Start    Esc · Pause / release mouse', resize: 'Resize window', expand: 'Expand / restore',
        resizeHint: 'Drag the corner to resize; arrow keys when focused.',
        trainTab: 'Drills', recordTab: 'Records',
        click: 'Click', reaction: 'Reaction', track: 'Tracking',
        start: 'Start drill', again: 'Run it again',
        clickHint: 'Hit every target. Background clicks lower your accuracy.',
        reactionHint: 'Wait for the target, then click it as fast as you can.',
        trackHint: 'Keep the centre crosshair on the moving target until time runs out.',
        hits: 'Hits', accuracy: 'Accuracy', timeLeft: 'Time left', round: 'Round',
        clickBest: 'Most hits', reactionBest: 'Fastest average', trackBest: 'Best on target',
        noRecord: 'No record yet', done: 'Drill over', ready: 'Get ready', now: 'Now!',
        early: 'Too soon — wait for the target.', timeUp: 'Time is up.',
        ms: 'ms', sec: 's', newRecord: 'New record',
        ghost: 'Ghost opponent', ghostHint: 'Race the pace of your best completed click run. Target positions are random.',
        ghostEmpty: 'Finish a click drill to record your first ghost.', ghostSaved: 'New ghost saved for next time.',
        ghostStorage: 'Ghost recording is unavailable. Check browser storage.',
        ghostAhead: 'Ahead by', ghostBehind: 'Behind by', ghostTied: 'Tied with ghost', ghostBest: 'Ghost final score',
        versusTab: 'Versus',
        nameLabel: 'Your name', codeLabel: 'Room code',
        createRoom: 'Create room', joinRoom: 'Join room', connect: 'Connect',
        joinHint: 'Paste the whole code your friend sends, relay letter included (e.g. ABC234-E).',
        relayHint: 'The last letter names the relay. Send the whole code.',
        connecting: 'Connecting to the relay…', online: 'Relay', latency: 'Latency',
        copyCode: 'Copy code', copied: 'Copied', leaveRoom: 'Leave room',
        waitingFriend: 'Waiting for a friend to join…', rivalJoined: 'Rival joined',
        hostTag: 'Host', youTag: 'You', readyChip: 'Ready', waitingChip: 'Not ready',
        readyButton: 'Ready up', unready: 'Stand down', startMatch: 'Start match',
        needReady: 'At least 2 players must join, and all online players must be ready.', matchIn: 'Starts in',
        roomSize: 'Players', roomHint: '2–5 players. The host starts when everyone is ready.',
        reactionRounds: 'Reaction rounds', roundsHint: 'The host chooses 5–20 rounds before starting.',
        rank: 'Rank', leaderboard: 'Standings', completed: 'Finished', withdrawn: 'Withdrew', playerOffline: 'Offline',
        hostLeft: 'The host has left. Leave this room and create or join another.',
        roomFull: 'This room already has 5 players.', matchInProgress: 'A match is in progress. Join when the room returns to the lobby.',
        versionMismatch: 'Room versions differ. All players must update to the same version.',
        you: 'You', rival: 'Rival', youWin: 'You win', youLose: 'You lose', draw: 'Draw',
        rematch: 'Rematch', waitingHost: 'Waiting for the host…', results: 'Result',
        offline: 'Relay connection lost.', roomMissing: 'No live room with that code yet.',
        relayUnreachable: 'Cannot reach the relay that hosts this room. Check your network and try again.',
        unknownRelay: 'That relay letter is not recognised. Ask the host to share the code again.',
        connectTimeout: 'Timed out reaching the relay. Check your network and try again.',
        codeUnavailable: 'No free room code right now. Please try again.',
        webSocketUnavailable: 'This environment cannot open a WebSocket, so multiplayer is unavailable.',
        badCode: 'That room code looks incomplete. Check all characters and try again.',
        cancel: 'Back', syncHint: 'Clock sync in progress…',
        backToRoom: 'Back to room', waitingResult: 'Score submitted. Waiting for the other players…',
        requestRematch: 'Request rematch', rematchRequested: 'Rematch requested',
        rivalWantsRematch: 'A player requested a rematch.',
        clickRule: 'More hits wins. Equal hits is a draw.',
        reactionRule: 'Lower average reaction time wins. Equal times is a draw.',
      },
      zh: {
        brandTagline: '精准瞄准训练', settingsTab: '设置', settingsHint: '调整操作手感和训练场的呈现方式。',
        trainingLibrary: '训练项目', localTraining: '你的专属训练场', localTrainingHint: '按自己的节奏训练。单人训练成绩保存在当前浏览器。',
        gridshot: '三点速射', reactionTask: '反应射击', trackingTask: '动态跟枪',
        clickCategory: '精准度与速度', reactionCategory: '反应与时机', trackCategory: '控制与稳定',
        clickHint3d: '移动鼠标转动视角，让球靶进入中央准星，按左键射击。在三个目标之间保持稳定的命中节奏。',
        reactionHint3d: '等待球靶出现，再转动视角并射击。成功命中后记录本轮反应时间。',
        trackHint3d: '移动鼠标转动视角，让中央准星持续跟随移动球靶，尽可能延长瞄准目标的时间。',
        mouseLookHint: '鼠标转动视角 · 左键射击 · Esc 暂停',
        focusTitle: '练习稳定控制', improveTitle: '看见训练进步', improveHint: '先保证精准，再逐渐提速。在记录页对比每次完成的训练。',
        sensitivity: '鼠标灵敏度', fieldOfView: '视野角度', settingsControls: '操作设置', settingsPresentation: '画面与声音',
        sensitivityHint: '灵敏度单位为每像素鼠标移动对应的视角度数。这些设置适用于全部训练项目，并保存在当前浏览器。',
        sceneLabel: '三维瞄准训练场', pause: '暂停并释放鼠标', paused: '训练已暂停',
        pauseHint: '训练计时已暂停。点击继续后将重新锁定鼠标，返回训练场。',
        inputReleased: '鼠标已释放', onlineClockContinues: '当前为联机对战。释放鼠标期间，对局计时仍会继续。',
        resumeTraining: '继续训练', backToTasks: '返回训练项目', escapePause: 'ESC  ·  释放鼠标 / 暂停', waitForTarget: '等待球靶出现…',
        webglUnavailable: '浏览器未能启动 WebGL。请启用硬件图形加速，或换用支持的浏览器后重试。',
        webglLost: '图形上下文已丢失。请重新初始化画面，恢复训练场。',
        pointerLockUnavailable: '当前环境不支持鼠标锁定。请在支持 Pointer Lock 的浏览器中打开插件。',
        pointerLockFailed: '未能锁定鼠标。请再次点击继续或开始重试。', retryGraphics: '重新初始化画面',
        sessionComplete: '本次训练完成', sessionTrend: '本局表现', recentRuns: '最近训练',
        score: '成绩', duration: '训练时长', targetsHit: '命中 / 射击', averageHitTime: '平均命中耗时', onTargetTime: '瞄准目标时间', fastestReaction: '最快单次反应',
        savedLocally: '已保存在当前浏览器', historyHint: '完成一次训练，即可开始积累自己的成绩记录。',
        saveFailed: '本局未能保存，请检查浏览器存储空间或权限。', ghostSaveFailed: '新幽灵未能保存。',
        completedRuns: '次已完成训练', trainingTask: '训练项目', date: '时间', legacyRecords: '原二维训练成绩',
        updateTitle: '插件更新', currentVersion: '当前版本', latestVersion: 'GitHub 最新版本',
        checkUpdates: '检查更新', checkingUpdates: '正在检查…', updateAvailable: '发现新版本。',
        updateCurrent: '已是最新版本。', updateAhead: '当前本地版本比 GitHub 更新。',
        updateFailed: '检查失败，请确认能访问 GitHub 后重试。',
        updateSteps: '复制下方地址，在插件页面移除「瞄准训练」，再通过「安装」填入此地址。安装后刷新页面。所有玩家都更新后，请重新创建房间。',
        updateCopy: '复制安装地址', updateCopyFailed: '复制失败，请手动选中并复制下方地址。',
        updateSource: '查看本次检查的提交', updatePrivacy: '点击时才访问 GitHub，不会自动安装。',
        updateLocalHint: '如果通过本地 Git 克隆安装，在克隆目录执行 git pull 后刷新即可。',
        title: '瞄准训练', open: '打开瞄准训练', close: '关闭',
        center: '窗口回到中间', drag: '拖动移动窗口',
        feelSound: '音效', feelCrosshair: '准星', feelGun: '枪械视角', feelEffects: '命中特效',
        feelCross: '十字', feelDot: '圆点', feelRing: '圆环',
        rangeTitle: '精准训练场', rangeSubtitle: '找到节奏，让每一次命中都更稳。',
        shortcuts: '空格 · 开始    Esc · 暂停 / 释放鼠标', resize: '调整窗口大小', expand: '放大 / 还原',
        resizeHint: '拖动右下角缩放；聚焦后可用方向键调整。',
        trainTab: '训练', recordTab: '记录',
        click: '点击', reaction: '反应', track: '跟枪',
        start: '开始训练', again: '再来一局',
        clickHint: '打中出现的靶子，点空白处会拉低命中率。',
        reactionHint: '等靶子出现，尽快点中它。',
        trackHint: '让中央准星持续跟随移动球靶，直到时间结束。',
        hits: '命中', accuracy: '命中率', timeLeft: '剩余', round: '回合',
        clickBest: '最高命中', reactionBest: '最快平均反应', trackBest: '最佳跟枪',
        noRecord: '还没有记录', done: '训练结束', ready: '准备', now: '点它！',
        early: '太早了，等靶子出现。', timeUp: '时间到。',
        ms: '毫秒', sec: '秒', newRecord: '新纪录',
        ghost: '幽灵对手', ghostHint: '跟自己最好一局的命中节奏竞速，靶子位置仍随机生成。',
        ghostEmpty: '完成一局点击训练，就能录下你的第一个幽灵。', ghostSaved: '已保存新幽灵，下局即可挑战。',
        ghostStorage: '无法保存幽灵记录，请检查浏览器存储设置。',
        ghostAhead: '领先', ghostBehind: '落后', ghostTied: '与幽灵持平', ghostBest: '幽灵最终成绩',
        versusTab: '对战',
        nameLabel: '你的昵称', codeLabel: '房间码',
        createRoom: '创建房间', joinRoom: '加入房间', connect: '连接',
        joinHint: '粘贴好友发来的完整房间码，末尾的中继字母也要带上，例如 ABC234-E。',
        relayHint: '末位字母代表中继，转发时请整串发送。',
        connecting: '正在连接中继…', online: '中继', latency: '延迟',
        copyCode: '复制房间码', copied: '已复制', leaveRoom: '离开房间',
        waitingFriend: '等待好友加入…', rivalJoined: '对手已加入',
        hostTag: '房主', youTag: '你', readyChip: '已准备', waitingChip: '未准备',
        readyButton: '准备', unready: '取消准备', startMatch: '开始对战',
        needReady: '至少 2 人加入，且所有在线玩家准备好才能开始。', matchIn: '倒计时',
        roomSize: '房间人数', roomHint: '2～5 人，所有人准备后由房主开局。',
        reactionRounds: '反应赛轮数', roundsHint: '房主可在开局前选择 5～20 轮。',
        rank: '名次', leaderboard: '排行榜', completed: '已完成', withdrawn: '已退出', playerOffline: '已离线',
        hostLeft: '房主已离开，请退出后创建或加入其他房间。',
        roomFull: '房间已满，最多 5 人。', matchInProgress: '对局正在进行，请等房间返回大厅后再加入。',
        versionMismatch: '房间版本不一致，请所有玩家更新到相同版本。',
        you: '你', rival: '对手', youWin: '你赢了', youLose: '你输了', draw: '平局',
        rematch: '再来一局', waitingHost: '等待房主开始…', results: '结果',
        offline: '中继连接已断开。', roomMissing: '还没有这个房间码的对局。',
        relayUnreachable: '连不上房主所在的中继，请检查网络后重试。',
        unknownRelay: '房间码里的中继标识无法识别，请让房主重新分享。',
        connectTimeout: '连接中继超时，请检查网络后重试。',
        codeUnavailable: '暂时找不到空闲房间码，请再试一次。',
        webSocketUnavailable: '当前环境不支持 WebSocket，无法联机。',
        badCode: '房间码不完整，请检查后重试。',
        cancel: '返回', syncHint: '正在同步时钟…',
        backToRoom: '返回房间', waitingResult: '成绩已提交，等待其他玩家完成…',
        requestRematch: '请求再来一局', rematchRequested: '已请求重开',
        rivalWantsRematch: '有玩家请求再来一局。',
        clickRule: '命中数多者获胜，命中数相同则平局。',
        reactionRule: '平均反应时间短者获胜，时间相同则平局。',
      },
    };

    const CSS = `
      .at-root { position:fixed; right:70px; top:74px; z-index:46; pointer-events:none; }
      .at-root * { box-sizing:border-box; }
      .at-launch { pointer-events:auto; display:grid; place-items:center; width:46px; height:46px; margin-left:auto; border:1px solid; border-radius:8px; box-shadow:0 5px 16px #0003; cursor:pointer; font-size:23px; }
      .at-launch svg { width:26px; height:26px; }
      .at-win { pointer-events:auto; position:fixed; z-index:61; display:flex; flex-direction:column; max-height:calc(100dvh - 16px); outline:none; }
      .at-bar { display:flex; align-items:center; flex-shrink:0; cursor:grab; user-select:none; touch-action:none; }
      .at-bar.at-drag { cursor:grabbing; }
      .at-spacer { flex:1; }
      .at-ico { display:grid; place-items:center; padding:0; font-size:15px; cursor:pointer; flex-shrink:0; }
      .at-tab { border:0; font:inherit; cursor:pointer; }
      .at-mode { font:inherit; cursor:pointer; }
      .at-content { overscroll-behavior:contain; scrollbar-width:thin; }
      .at-footer { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; font-size:10px; }
      .at-resize { width:30px; height:25px; padding:0; border:0; background:transparent; cursor:nwse-resize; touch-action:none; }
      .at-vs { display:flex; flex-direction:column; }
      .at-field { display:flex; flex-direction:column; gap:6px; }
      .at-label { font-size:10px; letter-spacing:.1em; }
      .at-input { width:100%; font:inherit; font-size:12px; }
      .at-row { display:flex; gap:10px; }
      .at-row > * { flex:1; }
      .at-codebox { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border:1px solid; }
      .at-code { font-size:26px; font-weight:700; letter-spacing:.2em; font-variant-numeric:tabular-nums; }
      .at-ghost { cursor:pointer; }
      .at-players { display:flex; flex-direction:column; border:1px solid #3b515e; border-radius:6px; overflow:hidden; }
      .at-player { display:flex; align-items:center; gap:8px; padding:12px; font-size:12px; }
      .at-player + .at-player { border-top:1px solid #3b515e; }
      .at-player-name { flex:1; min-width:0; overflow-wrap:anywhere; font-weight:600; }
      .at-player-value { font-variant-numeric:tabular-nums; white-space:nowrap; }
      .at-rank { width:24px; color:#48d2d7; font-weight:700; text-align:center; }
      .at-chip { padding:3px 7px; border:1px solid; border-radius:3px; font-size:9px; letter-spacing:.08em; }
      .at-chip.at-on { background:#173b36; }
      .at-duel-line { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid; font-size:11px; }
      .at-duel-line strong { font-size:15px; font-variant-numeric:tabular-nums; }
      .at-count-big { display:grid; place-items:center; gap:6px; min-height:200px; }
      .at-count-num { color:#c4f4f3; font-size:74px; font-weight:700; font-variant-numeric:tabular-nums; }
      .at-banner { display:grid; place-items:center; gap:6px; padding:20px; border:1px solid; text-align:center; }
      .at-banner-big { font-size:26px; font-weight:700; }
      .at-note { margin:0; font-size:11px; line-height:1.7; }
      @media (max-width:600px) { .at-root { right:62px; top:62px; } }
    `;

    function readRecords() {
      const empty = { click: null, reaction: null, track: null };
      let raw = {};
      try {
        raw = JSON.parse(window.localStorage.getItem(REC_KEY) || '{}');
      } catch (_) { /* Recover available bests from valid history. */ }
      const history = readRunHistory();
      for (const key of Object.keys(empty)) empty[key] = bestRunScore(key, raw, history);
      const stored = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      if (Object.keys(empty).some((key) => empty[key] !== null && empty[key] !== stored[key])) {
        try { window.localStorage.setItem(REC_KEY, JSON.stringify(empty)); } catch (_) { /* Recovered bests remain available this session. */ }
      }
      return empty;
    }

    function fitSize(width, height) {
      const maxW = Math.max(240, window.innerWidth - 16);
      const maxH = Math.max(280, window.innerHeight - 16);
      return { width: Math.min(maxW, Math.max(Math.min(460, maxW), width)), height: Math.min(maxH, Math.max(Math.min(520, maxH), height)) };
    }
    function loadSize() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(SIZE_KEY) || 'null');
        if (raw && Number.isFinite(raw.width) && Number.isFinite(raw.height)) return raw.expanded ? fitSize(window.innerWidth - 16, window.innerHeight - 16) : fitSize(raw.width, raw.height);
      } catch (_) { /* Use defaults. */ }
      return fitSize(window.innerWidth - 16, window.innerHeight - 16);
    }

    function loadPosition() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(POS_KEY) || 'null');
        if (raw && Number.isFinite(raw.left) && Number.isFinite(raw.top)) return { left: raw.left, top: raw.top };
      } catch (_) { /* Fall back to the centred default. */ }
      return null;
    }

    function defaultPosition() {
      const size = loadSize();
      return { left: Math.max(8, Math.round((window.innerWidth - size.width) / 2)), top: Math.max(8, Math.round((window.innerHeight - size.height) / 2)) };
    }

    function isExpanded(size) {
      return size.width >= window.innerWidth - 18 && size.height >= window.innerHeight - 18;
    }

    function clampToViewport(left, top, width, height) {
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const maxTop = Math.max(8, window.innerHeight - height - 8);
      return {
        left: Math.min(Math.max(8, left), maxLeft),
        top: Math.min(Math.max(8, top), maxTop),
      };
    }

    function ClickGame(props) { return h(RangeGame, { ...props, mode: 'click' }); }
    function ReactionGame(props) { return h(RangeGame, { ...props, mode: 'reaction' }); }
    function TrackGame(props) { return h(RangeGame, { ...props, mode: 'track' }); }

    function tabPlayerId() {
      try {
        const existing = window.sessionStorage.getItem(PID_KEY);
        if (existing) return existing;
        const created = newPlayerId();
        window.sessionStorage.setItem(PID_KEY, created);
        return created;
      } catch (_) {
        return newPlayerId();
      }
    }

    function readName() {
      try { return window.localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; }
    }

    function saveName(value) {
      try { window.localStorage.setItem(NAME_KEY, value); } catch (_) { /* session only */ }
    }

    function useTicker(active, step = 200) {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        if (!active) return undefined;
        const id = window.setInterval(() => setNow(Date.now()), step);
        return () => window.clearInterval(id);
      }, [active, step]);
      return now;
    }

    function useVersus() {
      const [stage, setStage] = React.useState('idle');
      const [error, setError] = React.useState('');
      const [status, setStatus] = React.useState({ phase: 'idle', broker: '' });
      const [snap, setSnap] = React.useState(null);
      const [name, setName] = React.useState(readName);
      const linkRef = React.useRef(null);
      const nameRef = React.useRef(name);
      nameRef.current = name;

      const sync = React.useCallback(() => {
        const link = linkRef.current;
        if (!link) return;
        const room = link.room;
        setSnap({
          code: link.code,
          shareCode: link.shareCode || link.code,
          broker: link.broker,
          role: room.role,
          hostId: room.state.hostId,
          me: room.playerId,
          phase: room.state.phase,
          players: room.state.players.map((player) => ({ ...player })),
          results: { ...room.state.results },
          mode: room.state.mode,
          seed: room.state.seed,
          startAt: room.state.startAt,
          matchId: room.state.matchId,
          rematchRequested: room.state.rematchRequested,
          durationMs: room.state.durationMs,
          offset: room.clock.offset,
          rtt: room.clock.rtt,
          rounds: room.state.rounds,
          participantIds: [...(room.state.participantIds || [])],
          progress: Object.fromEntries(Object.entries(room.progress || {}).map(([id, value]) => [id, { ...value }])),
        });
      }, []);

      const act = React.useCallback((fn) => {
        const link = linkRef.current;
        if (!link) return undefined;
        const value = fn(link.room);
        sync();
        return value;
      }, [sync]);

      const connect = React.useCallback(async (role, code) => {
        if (linkRef.current) { linkRef.current.close(); linkRef.current = null; }
        setStage('connecting');
        setError('');
        try {
          const link = await openRoom({
            role,
            code,
            name: (nameRef.current || '').trim() || 'Player',
            playerId: tabPlayerId(),
            onStatus: (next) => setStatus(next),
            onUpdate: sync,
          });
          linkRef.current = link;
          setStatus({ phase: 'online', broker: link.broker });
          setStage('room');
          sync();
        } catch (err) {
          setError(String((err && err.message) || err));
          setStage('error');
          setStatus({ phase: 'idle', broker: '' });
        }
      }, [sync]);

      const leave = React.useCallback(() => {
        if (linkRef.current) linkRef.current.close();
        linkRef.current = null;
        setSnap(null);
        setStage('idle');
        setStatus({ phase: 'idle', broker: '' });
        setError('');
      }, []);

      React.useEffect(() => () => { if (linkRef.current) linkRef.current.close(); }, []);

      return { stage, error, status, snap, name, setName, connect, leave, act };
    }

    function DuelGame({ vs, ...props }) {
      const report = (data) => ({
        score: data.score, hits: data.hits,
        misses: Math.max(0, data.shots - data.hits), acc: data.accuracy,
      });
      return h(RangeGame, {
        ...props, multiplayer: true,
        onLeave: vs.leave,
        statusPanel: h(MatchProgress, { snap: vs.snap, t: props.t }),
        onFinish: (_mode, _score, data) => vs.act((room) => room.finish(report(data))),
        onProgress: (data) => vs.act((room) => room.reportProgress(report(data))),
      });
    }
    function DuelClick(props) { return h(DuelGame, { ...props, mode: 'click' }); }
    function DuelReaction(props) { return h(DuelGame, { ...props, mode: 'reaction' }); }

    function matchPlayers(snap) {
      const ids = snap.participantIds;
      return ids && ids.length ? snap.players.filter((player) => ids.includes(player.id)) : snap.players;
    }

    function scoreText(result, mode, t) {
      if (!result) return '—';
      if (result.dnf || result.withdrawn) return t('withdrawn');
      return result.score + (mode === 'reaction' ? ' ' + t('ms') : '');
    }

    function MatchProgress({ snap, t }) {
      return h('div', { className: 'at-players', 'aria-label': t('leaderboard') },
        matchPlayers(snap).map((player) => {
          const result = snap.results[player.id];
          const progress = (snap.progress || {})[player.id];
          const value = result ? scoreText(result, snap.mode, t)
            : snap.mode === 'reaction' ? `${progress ? progress.hits : 0}/${snap.rounds || 8}`
              : progress ? progress.score : 0;
          return h('div', { key: player.id, className: 'at-player' },
            h('span', { className: 'at-player-name' }, `${player.name || player.id}${player.id === snap.me ? ' · ' + t('youTag') : ''}`),
            result && !result.dnf ? h('span', { className: 'at-chip at-on' }, t('completed')) : null,
            h('strong', { className: 'at-player-value' }, value),
          );
        }),
      );
    }

    function DuelResults({ vs, t }) {
      const snap = vs.snap;
      const participants = matchPlayers(snap);
      const lowerWins = snap.mode === 'reaction';
      const pending = participants.some((player) => !snap.results[player.id]);
      const entries = participants.map((player) => ({ player, result: snap.results[player.id] }));
      const valid = (entry) => Boolean(entry.result && !entry.result.dnf && !entry.result.withdrawn);
      entries.sort((a, b) => {
        if (valid(a) !== valid(b)) return valid(a) ? -1 : 1;
        if (!valid(a)) return 0;
        return lowerWins ? a.result.score - b.result.score : b.result.score - a.result.score;
      });
      let lastScore = null;
      let rank = 0;
      const ranked = entries.map((entry, index) => {
        if (!valid(entry)) return { ...entry, rank: null };
        if (lastScore !== entry.result.score) rank = index + 1;
        lastScore = entry.result.score;
        return { ...entry, rank };
      });
      const mine = ranked.find((entry) => entry.player.id === snap.me);
      const leaders = ranked.filter((entry) => entry.rank === 1);
      let verdict = t('results');
      if (!pending && mine) {
        verdict = mine.rank === 1 ? t(leaders.length > 1 ? 'draw' : 'youWin') : t('youLose');
      }
      const online = snap.players.filter((player) => player.online !== false && !player.withdrawn);
      const canRematch = online.length >= 2 && online.every((player) => player.ready);

      return h('div', { className: 'at-vs' },
        h('div', { className: 'at-banner' },
          h('span', { className: 'at-banner-big' }, verdict),
          mine && mine.rank ? h('span', { className: 'at-note' }, `${t('rank')} · ${mine.rank} / ${participants.length}`) : null,
          pending ? h('span', { className: 'at-note' }, t('waitingResult')) : null,
        ),
        h('p', { className: 'at-note' }, lowerWins ? t('reactionRule') : t('clickRule')),
        h('div', { className: 'at-players', 'aria-label': t('leaderboard') },
          ranked.map((entry) => h('div', { key: entry.player.id, className: 'at-player' },
            h('span', { className: 'at-rank' }, entry.rank || '—'),
            h('span', { className: 'at-player-name' }, `${entry.player.name || entry.player.id}${entry.player.id === snap.me ? ' · ' + t('youTag') : ''}`),
            h('strong', { className: 'at-player-value' }, scoreText(entry.result, snap.mode, t)),
          )),
        ),
        snap.role === 'host' && snap.rematchRequested ? h('p', { className: 'at-note' }, t('rivalWantsRematch')) : null,
        snap.role === 'host' && !canRematch ? h('p', { className: 'at-note' }, t('needReady')) : null,
        h('div', { className: 'at-row' },
          h('button', {
            className: 'at-primary',
            type: 'button',
            disabled: pending || (snap.role === 'host' ? !canRematch : snap.rematchRequested === snap.me),
            onClick: () => vs.act((room) => room.rematch()),
          }, snap.role === 'host' ? t('rematch') : snap.rematchRequested === snap.me ? t('rematchRequested') : t('requestRematch')),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.act((room) => room.returnToLobby()) }, t('backToRoom')),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        ),
      );
    }

    function VersusPanel({ vs, t, visible = true }) {
      const now = useTicker(true);
      const [codeInput, setCodeInput] = React.useState('');
      const [copied, setCopied] = React.useState(false);
      const snap = vs.snap;

      const me = snap ? snap.players.find((player) => player.id === snap.me) : null;
      const host = snap ? snap.players.find((player) => player.id === snap.hostId) : null;
      const startLocal = snap && snap.startAt ? snap.startAt - snap.offset : 0;
      const finished = Boolean(snap && snap.phase === 'finished');
      const submitted = Boolean(snap && snap.results[snap.me]);
      const playing = Boolean(snap && startLocal && now >= startLocal && !finished && !submitted);

      function copyCode() {
        const code = snap ? snap.shareCode || snap.code : '';
        if (!code) return;
        const done = () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        };
        try {
          navigator.clipboard.writeText(code).then(done, done);
        } catch (_) {
          done();
        }
      }

      if (vs.stage === 'connecting') {
        return h('div', { className: 'at-vs' },
          h('p', { className: 'at-note' }, `${t('connecting')} ${vs.status.broker || ''}`),
        );
      }

      if (vs.stage !== 'room' || !snap) {
        return h('div', { className: 'at-vs' },
          h('label', { className: 'at-field' },
            h('span', { className: 'at-label' }, t('nameLabel')),
            h('input', {
              className: 'at-input',
              value: vs.name,
              maxLength: 16,
              onChange: (event) => { vs.setName(event.target.value); saveName(event.target.value); },
            }),
          ),
          h('button', { className: 'at-primary', type: 'button', onClick: () => vs.connect('host') }, t('createRoom')),
          h('label', { className: 'at-field' },
            h('span', { className: 'at-label' }, t('codeLabel')),
            h('input', {
              className: 'at-input',
              value: codeInput,
              maxLength: 10,
              placeholder: 'ABC234-E',
              onChange: (event) => setCodeInput(event.target.value.toUpperCase()),
            }),
          ),
          h('button', {
            className: 'at-ghost',
            type: 'button',
            disabled: parseInvite(codeInput).code.length !== 6,
            onClick: () => vs.connect('guest', parseInvite(codeInput).code ? codeInput : ''),
          }, t('joinRoom')),
          h('p', { className: 'at-note' }, vs.stage === 'error' ? ({
            'no-broker': t('offline'),
            'room-full': t('roomFull'),
            'match-in-progress': t('matchInProgress'),
            'app-mismatch': t('versionMismatch'),
            'room-not-found': t('roomMissing'),
            'relay-unreachable': t('relayUnreachable'),
            'unknown-relay': t('unknownRelay'),
            'connect-timeout': t('connectTimeout'),
            'room-code-unavailable': t('codeUnavailable'),
            'websocket-unavailable': t('webSocketUnavailable'),
            'bad-code': t('badCode'),
          }[vs.error] || vs.error) : t('joinHint')),
        );
      }

      if (host && host.online === false) {
        return h('div', { className: 'at-vs' },
          h('p', { className: 'at-note' }, t('hostLeft')),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      if (finished) return h(DuelResults, { vs, t });

      if (submitted) {
        return h('div', { className: 'at-vs' },
          h('p', { className: 'at-note' }, vs.status.phase === 'offline' ? t('offline') : t('waitingResult')),
          h(MatchProgress, { snap, t }),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      if (playing) {
        return h('div', { className: 'at-vs' },
          snap.mode === 'reaction'
            ? h(DuelReaction, { key: snap.matchId, vs, t, visible, seed: snap.seed, rounds: snap.rounds || 8, startLocal })
            : h(DuelClick, { key: snap.matchId, vs, t, visible, seed: snap.seed, durationMs: snap.durationMs || 30000, startLocal }),
          h(MatchProgress, { snap, t }),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      if (snap.startAt) {
        const remain = Math.max(0, Math.ceil((startLocal - now) / 1000));
        return h('div', { className: 'at-vs' },
          h('div', { className: 'at-count-big' },
            h('span', { className: 'at-count-num' }, remain),
            h('span', { className: 'at-label' }, t('matchIn')),
          ),
          h('p', { className: 'at-note' }, `${t(snap.mode)}${snap.mode === 'reaction' ? ' · ' + snap.rounds + ' ' + t('round') : ''}`),
          h(MatchProgress, { snap, t }),
          h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
        );
      }

      const ready = Boolean(me && me.ready);
      const online = snap.players.filter((player) => player.online !== false && !player.withdrawn);
      const allReady = online.length >= 2 && online.every((player) => player.ready);

      return h('div', { className: 'at-vs' },
        h('div', { className: 'at-codebox' },
          h('div', null,
            h('div', { className: 'at-label' }, t('codeLabel')),
            h('div', { className: 'at-code' }, snap.shareCode || snap.code),
            h('div', { className: 'at-note' }, t('relayHint')),
          ),
          h('button', { className: 'at-ghost', type: 'button', onClick: copyCode }, copied ? t('copied') : t('copyCode')),
        ),
        h('p', { className: 'at-note' }, `${t('roomSize')} · ${online.length} / 5 — ${t('roomHint')}`),
        h('div', { className: 'at-players' },
          snap.players.map((player) => h('div', { key: player.id, className: 'at-player' },
            h('span', { className: 'at-player-name' }, player.id === snap.me ? `${player.name} · ${t('youTag')}` : player.name),
            player.id === snap.hostId ? h('span', { className: 'at-chip' }, t('hostTag')) : null,
            h('span', { className: 'at-chip' + (player.ready ? ' at-on' : '') }, player.online === false ? t('playerOffline') : player.ready ? t('readyChip') : t('waitingChip')),
          )),
        ),
        !allReady ? h('p', { className: 'at-note' }, online.length < 2 ? t('waitingFriend') : t('needReady')) : null,
        h('div', { className: 'at-modes at-two' },
          ['click', 'reaction'].map((key) => h('button', {
            key,
            type: 'button',
            className: 'at-mode',
            'aria-pressed': snap.mode === key,
            disabled: snap.role !== 'host',
            onClick: () => vs.act((room) => { room.state.mode = key; room.publishState(); }),
          }, t(key))),
        ),
        snap.mode === 'reaction' ? h('label', { className: 'at-field' },
          h('span', { className: 'at-label' }, t('reactionRounds')),
          h('select', {
            className: 'at-input', value: snap.rounds || 8, disabled: snap.role !== 'host',
            onChange: (event) => vs.act((room) => room.setReactionRounds(Number(event.target.value))),
          }, Array.from({ length: 16 }, (_, index) => index + 5).map((rounds) => h('option', { key: rounds, value: rounds }, rounds))),
          h('span', { className: 'at-note' }, t('roundsHint')),
        ) : null,
        h('div', { className: 'at-row' },
          h('button', { className: 'at-primary', type: 'button', onClick: () => vs.act((room) => room.setReady(!ready)) }, ready ? t('unready') : t('readyButton')),
          h('button', {
            className: 'at-primary',
            type: 'button',
            disabled: snap.role !== 'host' || !allReady,
            'data-shortcut-start': '',
            onClick: () => vs.act((room) => room.startMatch(snap.mode, { rounds: snap.rounds || 8 })),
          }, t('startMatch')),
        ),
        h('div', { className: 'at-duel-line' },
          h('span', null, `${t('online')} · ${snap.broker}`),
          h('strong', null, snap.rtt > 0 ? `${Math.round(snap.rtt)} ms` : '—'),
        ),
        h('button', { className: 'at-ghost', type: 'button', onClick: () => vs.leave() }, t('leaveRoom')),
      );
    }

    function targetIcon(mode = 'click') {
      return h('svg', { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true },
        mode === 'track'
          ? h('path', { d: 'M3 22c7 0 5-14 12-14s5 16 14 16M22 20l7 4-6 4' })
          : mode === 'reaction'
            ? h('path', { d: 'M18 2 7 18h8l-1 12 11-17h-8l1-11Z' })
            : h(React.Fragment, null, h('circle', { cx: 16, cy: 16, r: 10 }), h('circle', { cx: 16, cy: 16, r: 4 }), h('path', { d: 'M16 1v6m0 18v6M1 16h6m18 0h6' })));
    }

    function createTrainer(ctx, t) {
      return function AimTrainer() {
        const [open, setOpen] = React.useState(false);
        const [tab, setTab] = React.useState('train');
        const [mode, setMode] = React.useState('click');
        const [records, setRecords] = React.useState(readRecords);
        const [pos, setPosState] = React.useState(() => loadPosition() || defaultPosition());
        const [dragging, setDragging] = React.useState(false);
        const [, bump] = React.useState(0);
        const winRef = React.useRef(null);
        const posRef = React.useRef(pos);
        const grabRef = React.useRef(null);
        const vs = useVersus();
        const [size, setSize] = React.useState(loadSize);
        const resizeRef = React.useRef(null);
        const sizeRef = React.useRef(size);
        const expandedRef = React.useRef(isExpanded(size));
        sizeRef.current = size;

        function setPos(next) { posRef.current = next; setPosState(next); }
        function savePosition() {
          try { window.localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch (_) { /* Session only. */ }
        }
        React.useEffect(() => ctx.locale.subscribe(() => bump((n) => n + 1)), []);
        React.useEffect(() => {
          if (open) winRef.current?.focus({ preventScroll: true });
        }, [open]);
        React.useEffect(() => {
          if (!open) return undefined;
          const onResize = () => {
            const next = expandedRef.current
              ? fitSize(window.innerWidth - 16, window.innerHeight - 16)
              : fitSize(sizeRef.current.width, sizeRef.current.height);
            sizeRef.current = next; setSize(next);
            setPos(clampToViewport(posRef.current.left, posRef.current.top, next.width, next.height));
          };
          onResize();
          window.addEventListener('resize', onResize);
          return () => window.removeEventListener('resize', onResize);
        }, [open]);

        function grab(event) {
          if (event.button !== 0 || event.target.closest?.('button,input,select,a,[role="tablist"]')) return;
          const node = winRef.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          grabRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        function drag(event) {
          if (!grabRef.current || !winRef.current) return;
          const rect = winRef.current.getBoundingClientRect();
          setPos(clampToViewport(event.clientX - grabRef.current.dx, event.clientY - grabRef.current.dy, rect.width, rect.height));
        }
        function drop(event) {
          if (!grabRef.current) return;
          grabRef.current = null; setDragging(false); savePosition();
          event?.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        function resizeTo(width, height, expanded = false) {
          const next = fitSize(width, height);
          expandedRef.current = expanded;
          sizeRef.current = next; setSize(next);
          setPos(clampToViewport(posRef.current.left, posRef.current.top, next.width, next.height));
          try { window.localStorage.setItem(SIZE_KEY, JSON.stringify({ ...next, expanded })); } catch (_) { /* Session only. */ }
        }
        function centre() {
          const current = sizeRef.current;
          setPos(clampToViewport(Math.round((window.innerWidth - current.width) / 2), Math.round((window.innerHeight - current.height) / 2), current.width, current.height));
          savePosition();
        }
        function expand() {
          if (expandedRef.current) resizeTo(WIDTH, HEIGHT);
          else resizeTo(window.innerWidth - 16, window.innerHeight - 16, true);
          centre();
        }
        function startResize(event) {
          if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          resizeRef.current = { x: event.clientX, y: event.clientY, ...sizeRef.current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        function moveResize(event) {
          const start = resizeRef.current;
          if (start) resizeTo(start.width + event.clientX - start.x, start.height + event.clientY - start.y);
        }
        function stopResize(event) { resizeRef.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); }
        function onGameKey(event) {
          if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
          const panel = winRef.current?.querySelector('[data-active-panel="true"]');
          if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            if (panel?.querySelector('.ar-range[data-active="true"]')) document.exitPointerLock?.();
            else setOpen(false);
            return;
          }
          if (event.code !== 'Space' && event.key !== ' ') return;
          if (event.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="slider"]')) return;
          event.preventDefault(); event.stopPropagation();
          panel?.querySelector('[data-shortcut-start]:not(:disabled)')?.click();
        }
        function record(kind, value) {
          if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) return false;
          const previous = records[kind];
          if (previous !== null && !(kind === 'reaction' ? value < previous : value > previous)) return false;
          const next = { ...records, [kind]: value }; setRecords(next);
          try { window.localStorage.setItem(REC_KEY, JSON.stringify(next)); } catch (_) { /* Session only. */ }
          return true;
        }
        const soloVisible = open && tab === 'train';
        const taskTitle = (key) => t(key === 'click' ? 'gridshot' : key === 'reaction' ? 'reactionTask' : 'trackingTask');
        const game = mode === 'click' ? ClickGame : mode === 'reaction' ? ReactionGame : TrackGame;
        return h('div', { className: 'at-root' },
          h('style', null, CSS + APP_CSS),
          h('button', { type: 'button', className: 'at-launch', title: t(open ? 'close' : 'open'), 'aria-label': t(open ? 'close' : 'open'), 'aria-expanded': open, onClick: () => setOpen(!open) }, targetIcon()),
          h('section', {
            className: 'at-win', ref: winRef,
            style: { left: pos.left + 'px', top: pos.top + 'px', width: size.width + 'px', height: size.height + 'px', display: open ? 'flex' : 'none' },
            role: 'dialog', tabIndex: -1, onKeyDown: onGameKey, 'aria-label': t('title'),
            onPointerDownCapture: (event) => { if (!event.target.closest?.('button,input,textarea,select,a,[contenteditable]')) winRef.current?.focus({ preventScroll: true }); },
          },
            h('header', { className: 'at-bar' + (dragging ? ' at-drag' : ''), onPointerDown: grab, onPointerMove: drag, onPointerUp: drop, onPointerCancel: drop, title: t('drag') },
              h('div', { className: 'at-brand' }, targetIcon(), h('div', null, h('b', null, 'Aim Trainer'), h('small', null, t('brandTagline')))),
              h('nav', { className: 'at-app-nav', role: 'tablist', 'aria-label': t('title') },
                ...[['train', 'trainTab'], ['versus', 'versusTab'], ['records', 'recordTab'], ['settings', 'settingsTab']].map(([key, label]) =>
                  h('button', { key, className: 'at-tab', type: 'button', role: 'tab', 'aria-selected': tab === key, onClick: () => setTab(key) }, t(label)))),
              h('span', { className: 'at-spacer' }), h('span', { className: 'at-version' }, `v${APP_VERSION}`),
              h('button', { className: 'at-ico', type: 'button', title: t('expand'), 'aria-label': t('expand'), onClick: expand }, '⛶'),
              h('button', { className: 'at-ico', type: 'button', title: t('center'), 'aria-label': t('center'), onClick: centre }, '⌖'),
              h('button', { className: 'at-ico', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: () => setOpen(false) }, '×')),
            h('main', { className: 'at-content' },
              h('div', { className: 'at-training-shell', 'data-active-panel': tab === 'train' ? 'true' : 'false', style: { display: tab === 'train' ? 'grid' : 'none' } },
                h('aside', { className: 'at-sidebar' },
                  h('div', { className: 'at-side-label' }, t('trainingLibrary')),
                  h('div', { className: 'at-modes' }, ...['click', 'reaction', 'track'].map(key => h('button', {
                    key, className: 'at-mode', type: 'button', 'aria-pressed': mode === key, onClick: () => setMode(key),
                  }, targetIcon(key), h('span', null, taskTitle(key), h('small', null, t(`${key}Category`)))))),
                  h('div', { className: 'at-side-bottom' }, h('strong', null, t('localTraining')), h('p', null, t('localTrainingHint')))),
                h('div', { className: 'at-main-training' },
                  h('div', { className: 'at-breadcrumb' }, h('span', null, t('trainTab')), h('span', null, '/'), h('span', null, taskTitle(mode))),
                  h(game, { key: mode, t, onFinish: record, visible: soloVisible, onBack: () => setTab('train') }))),
              h('div', { 'data-active-panel': tab === 'versus' ? 'true' : 'false', style: { display: tab === 'versus' ? 'block' : 'none' } },
                h(VersusPanel, { vs, t, visible: open && tab === 'versus' })),
              tab === 'records' && h('div', { 'data-active-panel': 'true' }, h(RangeRecords, { t })),
              tab === 'settings' && h('div', { className: 'ar-settings-page', 'data-active-panel': 'true' },
                h('div', { className: 'ar-page-heading' }, h('span', { className: 'ar-eyebrow' }, 'AIM TRAINER'), h('h2', null, t('settingsTab')), h('p', null, t('settingsHint'))),
                h(RangeSettings, { t }))),
            h('footer', { className: 'at-footer' }, h('span', null, t('shortcuts')),
              h('button', { type: 'button', className: 'at-resize', 'aria-label': t('resize'), title: t('resizeHint'),
                onPointerDown: startResize, onPointerMove: moveResize, onPointerUp: stopResize, onPointerCancel: stopResize,
                onKeyDown: (event) => {
                  const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
                  if (delta) { event.preventDefault(); event.stopPropagation(); resizeTo(size.width + delta[0], size.height + delta[1]); }
                },
              }, '◢'))));
      };
    }

    function createUpdatePanel(ctx, t) {
      return function UpdatePanel({ view }) {
        const [result, setResult] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [copyStatus, setCopyStatus] = React.useState('');
        const request = React.useRef(null);
        const [, setLocale] = React.useState(0);
        React.useEffect(() => ctx.locale.subscribe(() => setLocale((n) => n + 1)), []);
        React.useEffect(() => () => {
          if (request.current) {
            clearTimeout(request.current.timer);
            request.current.controller.abort();
            request.current = null;
          }
        }, []);
        if (view !== 'page') return null;

        async function check() {
          if (request.current) return;
          const controller = new AbortController();
          const pending = { controller, timer: setTimeout(() => controller.abort(), 12000) };
          request.current = pending;
          setBusy(true);
          setResult(null);
          setCopyStatus('');
          try {
            const next = await checkForUpdates(APP_VERSION, { signal: controller.signal });
            if (request.current === pending) setResult(next);
          } catch (_) {
            if (request.current === pending) setResult({ status: 'error' });
          } finally {
            clearTimeout(pending.timer);
            if (request.current === pending) { request.current = null; setBusy(false); }
          }
        }
        async function copy() {
          try {
            await navigator.clipboard.writeText(result.spec);
            setCopyStatus('copied');
          } catch (_) { setCopyStatus('updateCopyFailed'); }
        }
        const statusKey = { available: 'updateAvailable', current: 'updateCurrent', ahead: 'updateAhead', error: 'updateFailed' };
        return h('section', { className: 'at-update', 'aria-label': t('updateTitle') },
          h('style', null, `
            .at-update { display:flex; flex-direction:column; gap:12px; padding:16px; margin:16px 0; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:1.6; }
            .at-update p, .at-update h3 { margin:0; }
            .at-update h3 { font-size:15px; font-weight:600; }
            .at-update-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
            .at-update button { border:1px solid var(--dsw-alias-border-l2); border-radius:8px; min-height:36px; padding:6px 14px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; }
            .at-update button:disabled { opacity:.6; cursor:wait; }
            .at-update button:focus-visible, .at-update a:focus-visible, .at-update textarea:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
            .at-update textarea { width:100%; min-height:74px; resize:vertical; padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; overflow-wrap:anywhere; }
            .at-update a { color:var(--dsw-alias-brand-primary); }
            .at-update-note { color:var(--dsw-alias-label-secondary); font-size:13px; }
          `),
          h('h3', null, t('updateTitle')),
          h('p', null, `${t('currentVersion')}: ${APP_VERSION}`),
          h('div', { className: 'at-update-actions' }, h('button', { type: 'button', disabled: busy, onClick: check }, t(busy ? 'checkingUpdates' : 'checkUpdates'))),
          h('div', { role: 'status', 'aria-live': 'polite' }, busy ? t('checkingUpdates') : result ? t(statusKey[result.status]) : ''),
          result?.version && h('p', null, `${t('latestVersion')}: ${result.version}`),
          result?.status === 'available' && h(React.Fragment, null,
            h('p', null, t('updateSteps')),
            h('textarea', { readOnly: true, value: result.spec, 'aria-label': t('updateCopy'), spellCheck: false }),
            h('div', { className: 'at-update-actions' },
              h('button', { type: 'button', onClick: copy }, t('updateCopy')),
              h('a', { href: result.url, target: '_blank', rel: 'noopener noreferrer' }, t('updateSource')),
            ),
            h('p', { role: 'status' }, copyStatus ? t(copyStatus) : ''),
            h('p', { className: 'at-update-note' }, t('updateLocalHint')),
          ),
          h('p', { className: 'at-update-note' }, t('updatePrivacy')),
        );
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', DICTS.en));
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICTS.zh));
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: '@local/aim-trainer' }, createUpdatePanel(ctx, t)));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'aim-trainer', order: 80 }, createTrainer(ctx, t)));
      },
    };

