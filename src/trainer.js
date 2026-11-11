    const h = React.createElement;
    const NS = 'aim-trainer';
    const REC_KEY = 'aim-trainer:records:v1';
    const POS_KEY = 'aim-trainer:panel:v1';
    const NAME_KEY = 'aim-trainer:name:v1';
    const PID_KEY = 'aim-trainer:player:v1';
    const WIDTH = 560;
    const CLICK_TIME = 30;
    const TRACK_TIME = 20;
    const REACTION_ROUNDS = 8;
    const COUNT_STEP = 900;

    const DICTS = {
      en: {
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
        trainTab: 'Drills', recordTab: 'Records',
        click: 'Click', reaction: 'Reaction', track: 'Tracking',
        start: 'Start drill', again: 'Run it again',
        clickHint: 'Hit every target. Background clicks lower your accuracy.',
        reactionHint: 'Wait for the target, then click it as fast as you can.',
        trackHint: 'Keep the cursor on the moving target until time runs out.',
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
        ready: 'Ready up', unready: 'Stand down', startMatch: 'Start match',
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
        trainTab: '训练', recordTab: '记录',
        click: '点击', reaction: '反应', track: '跟枪',
        start: '开始训练', again: '再来一局',
        clickHint: '打中出现的靶子，点空白处会拉低命中率。',
        reactionHint: '等靶子出现，尽快点中它。',
        trackHint: '把鼠标一直压在移动的靶子上，直到时间结束。',
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
        ready: '准备', unready: '取消准备', startMatch: '开始对战',
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
      .at-root { position:fixed; right:70px; top:74px; z-index:46; pointer-events:none; font-family:inherit; }
      .at-root * { box-sizing:border-box; }
      .at-launch { pointer-events:auto; display:grid; place-items:center; width:46px; height:46px; margin-left:auto; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-overlay); color:var(--dsw-alias-label-primary); box-shadow:0 5px 16px rgba(0,0,0,.18); cursor:pointer; font-size:23px; }
      .at-launch:hover, .at-launch:focus-visible { outline:2px solid #00e5c0; outline-offset:2px; }
      .at-win { pointer-events:auto; position:fixed; z-index:61; display:flex; flex-direction:column; width:min(${WIDTH}px, calc(100vw - 24px)); max-height:calc(100dvh - 24px); overflow:auto; border:1px solid #232e3a; border-radius:10px; background:#0b0e13; color:#e8eff5; box-shadow:0 26px 64px rgba(0,0,0,.55), 0 0 0 1px rgba(0,229,192,.06); }
      .at-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:9px; padding:10px 12px; border-bottom:1px solid #1d2733; background:#101720; cursor:grab; user-select:none; touch-action:none; }
      .at-bar.at-drag { cursor:grabbing; }
      .at-dot { width:7px; height:7px; border-radius:50%; background:#00e5c0; box-shadow:0 0 10px rgba(0,229,192,.9); }
      .at-name { font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#9fb2c2; }
      .at-spacer { flex:1; }
      .at-ico { width:26px; height:26px; display:grid; place-items:center; border:1px solid #243040; border-radius:4px; background:transparent; color:#8ea0b0; font:inherit; font-size:13px; cursor:pointer; }
      .at-ico:hover { border-color:#00e5c0; color:#00e5c0; }
      .at-tabs { display:flex; gap:4px; padding:0 12px 10px; border-bottom:1px solid #1d2733; background:#101720; }
      .at-tab { flex:1; padding:6px 4px; border:0; border-radius:3px; background:transparent; color:#7f8f9e; font:inherit; font-size:11px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
      .at-tab[aria-selected="true"] { background:#1a2733; color:#eef6fb; font-weight:700; }
      .at-modes { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; padding:12px 14px 0; }
      .at-modes.at-two { grid-template-columns:repeat(2, 1fr); }
      .at-mode { padding:9px 4px; border:1px solid #1e2833; border-radius:5px; background:#0d131a; color:#8698a7; font:inherit; font-size:11px; font-weight:650; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; }
      .at-mode:hover { border-color:#38495a; color:#cfe0ec; }
      .at-mode[aria-pressed="true"] { border-color:#00e5c0; color:#eafffa; background:#0e1c1d; box-shadow:inset 0 0 0 1px rgba(0,229,192,.28); }
      .at-arena { position:relative; height:clamp(250px, 44vh, 400px); margin:12px 14px; border:1px solid #1a222c; border-radius:6px; overflow:hidden; background:radial-gradient(circle at 50% 42%, #101923, #05080c 78%); cursor:crosshair; touch-action:none; }
      .at-grid { position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(140,190,220,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(140,190,220,.055) 1px, transparent 1px); background-size:44px 44px; }
      .at-target { position:absolute; width:46px; height:46px; margin:0; padding:0; transform:translate(-50%, -50%); border:0; border-radius:50%; background:radial-gradient(circle at 34% 28%, #ffd9c6, #ff6a3d 34%, #d32a09 68%, #7d1403 100%); box-shadow:0 0 24px rgba(255,90,50,.5), 0 0 0 3px rgba(255,120,80,.12); cursor:crosshair; }
      .at-target::after { content:''; position:absolute; left:14px; top:11px; width:12px; height:9px; border-radius:50%; background:rgba(255,255,255,.55); filter:blur(1px); }
      .at-track-target { width:52px; height:52px; background:radial-gradient(circle at 34% 28%, #d7fbff, #38d8ea 36%, #0f95b4 68%, #075068 100%); box-shadow:0 0 26px rgba(60,220,240,.5), 0 0 0 3px rgba(90,230,245,.14); }
      .at-count { position:absolute; inset:0; display:grid; place-items:center; background:rgba(4,8,12,.76); color:#fff; font-size:84px; font-weight:850; font-variant-numeric:tabular-nums; letter-spacing:.02em; animation:at-pop .9s ease-out; }
      @keyframes at-pop { 0% { transform:scale(.7); opacity:.15; } 35% { transform:scale(1.02); opacity:1; } 100% { transform:scale(1.08); opacity:.92; } }
      .at-flag { position:absolute; inset:0; display:grid; place-items:center; padding:18px; text-align:center; background:rgba(5,10,15,.7); color:#f2f8fc; font-size:16px; font-weight:700; letter-spacing:.02em; }
      .at-hint { position:absolute; left:16px; right:16px; bottom:13px; margin:0; color:#8496a6; font-size:11px; line-height:1.55; text-align:center; }
      .at-stats { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; padding:0 14px; }
      .at-stat { padding:8px 10px; border:1px solid #1a222c; border-radius:5px; background:#0e141c; }
      .at-stat-label { display:block; color:#7a8b9a; font-size:9px; letter-spacing:.14em; text-transform:uppercase; }
      .at-stat-value { display:block; margin-top:2px; color:#f2f8fc; font-size:20px; font-weight:800; font-variant-numeric:tabular-nums; }
      .at-status { margin:10px 14px 0; min-height:30px; color:#8b9dac; font-size:11px; line-height:1.5; }
      .at-status.at-hot { color:#ffd08a; }
      .at-actions { display:flex; gap:8px; padding:8px 14px 14px; }
      .at-primary { flex:1; min-height:44px; border:0; border-radius:5px; background:#00e5c0; color:#04231f; font:inherit; font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
      .at-primary:hover { background:#1cf3d2; }
      .at-primary:focus-visible, .at-mode:focus-visible, .at-tab:focus-visible, .at-ico:focus-visible { outline:2px solid #00e5c0; outline-offset:2px; }
      .at-records { padding:6px 14px 16px; }
      .at-record { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:50px; border-bottom:1px solid #1a222c; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#7f8f9e; }
      .at-record:last-child { border-bottom:0; }
      .at-record strong { color:#f2f8fc; font-size:18px; letter-spacing:0; text-transform:none; font-variant-numeric:tabular-nums; }
      .at-record strong.at-empty { color:#5d6d7b; font-size:12px; font-weight:500; }
      .at-vs { display:flex; flex-direction:column; gap:10px; padding:12px 14px 16px; }
      .at-field { display:flex; flex-direction:column; gap:5px; }
      .at-label { color:#7a8b9a; font-size:9px; letter-spacing:.14em; text-transform:uppercase; }
      .at-input { min-height:36px; padding:0 10px; border:1px solid #223141; border-radius:5px; background:#0d131a; color:#eef6fb; font:inherit; font-size:12px; letter-spacing:.12em; text-transform:uppercase; }
      .at-input:focus-visible { outline:2px solid #00e5c0; outline-offset:1px; }
      .at-row { display:flex; gap:8px; }
      .at-row > * { flex:1; }
      .at-codebox { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #1e3440; border-radius:6px; background:linear-gradient(180deg,#0c1a1f,#0a1218); }
      .at-code { color:#eafffa; font-size:25px; font-weight:850; letter-spacing:.24em; font-variant-numeric:tabular-nums; }
      .at-ghost { min-height:32px; padding:0 10px; border:1px solid #223141; border-radius:4px; background:transparent; color:#9fb2c2; font:inherit; font-size:11px; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
      .at-ghost:hover, .at-ghost:focus-visible { border-color:#00e5c0; color:#00e5c0; outline:none; }
      .at-players { display:flex; flex-direction:column; border:1px solid #1a222c; border-radius:6px; overflow:hidden; }
      .at-player { display:flex; align-items:center; gap:8px; padding:9px 11px; background:#0e141c; font-size:12px; }
      .at-player + .at-player { border-top:1px solid #1a222c; }
      .at-player-name { flex:1; min-width:0; overflow-wrap:anywhere; color:#e8eff5; font-weight:650; }
      .at-player-value { color:#eafffa; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .at-rank { width:24px; color:#00e5c0; font-weight:800; text-align:center; }
      .at-primary:disabled, .at-mode:disabled { opacity:.45; cursor:default; }
      .at-input:disabled { opacity:.7; cursor:default; }
      .at-chip { padding:2px 7px; border:1px solid #26364a; border-radius:3px; color:#8ea0b0; font-size:9px; letter-spacing:.12em; text-transform:uppercase; }
      .at-chip.at-on { border-color:#0f7f6c; background:#07231f; color:#7ff0da; }
      .at-duel-line { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; border:1px solid #1a222c; border-radius:6px; background:#0c1218; color:#7f8f9e; font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
      .at-duel-line strong { color:#eafffa; font-size:15px; font-variant-numeric:tabular-nums; letter-spacing:0; text-transform:none; }
      .at-count-big { display:grid; place-items:center; gap:6px; min-height:200px; }
      .at-count-num { color:#eafffa; font-size:74px; font-weight:850; font-variant-numeric:tabular-nums; }
      .at-banner { display:grid; place-items:center; gap:3px; padding:16px; border:1px solid #1e3440; border-radius:6px; background:linear-gradient(180deg,#0c1a1f,#0a1218); color:#eafffa; text-align:center; }
      .at-banner-big { font-size:23px; font-weight:850; letter-spacing:.06em; text-transform:uppercase; }
      .at-note { margin:0; color:#8496a6; font-size:11px; line-height:1.5; }
      @media (max-width:600px) { .at-root { right:62px; top:62px; } .at-win { width:calc(100vw - 16px); } }
      @media (prefers-reduced-motion:reduce) { .at-count { animation:none; } }
    `;

    function readRecords() {
      const empty = { click: null, reaction: null, track: null };
      try {
        const raw = JSON.parse(window.localStorage.getItem(REC_KEY) || '{}');
        for (const key of Object.keys(empty)) {
          const value = raw[key];
          empty[key] = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
        }
      } catch (_) { /* Corrupt storage falls back to an empty ledger. */ }
      return empty;
    }

    function loadPosition() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(POS_KEY) || 'null');
        if (raw && Number.isFinite(raw.left) && Number.isFinite(raw.top)) return { left: raw.left, top: raw.top };
      } catch (_) { /* Fall back to the centred default. */ }
      return null;
    }

    function defaultPosition() {
      const width = Math.min(WIDTH, window.innerWidth - 24);
      return { left: Math.max(8, Math.round((window.innerWidth - width) / 2)), top: 76 };
    }

    function clampToViewport(left, top, width, height) {
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const maxTop = Math.max(8, window.innerHeight - height - 8);
      return {
        left: Math.min(Math.max(8, left), maxLeft),
        top: Math.min(Math.max(8, top), maxTop),
      };
    }

    function spot() {
      return { x: 16 + Math.random() * 68, y: 20 + Math.random() * 60 };
    }

    function useCountdown(phase, setPhase, finish, ticks) {
      const [tick, setTick] = React.useState(ticks);
      React.useEffect(() => {
        if (phase !== 'countdown') return undefined;
        const id = window.setTimeout(() => {
          if (tick > 1) setTick(tick - 1);
          else finish();
        }, COUNT_STEP);
        return () => window.clearTimeout(id);
      }, [phase, tick]);
      return [tick, setTick];
    }

    function ClickGame({ t, onFinish }) {
      const [phase, setPhase] = React.useState('idle');
      const [left, setLeft] = React.useState(CLICK_TIME);
      const [hits, setHits] = React.useState(0);
      const [shots, setShots] = React.useState(0);
      const [pos, setPos] = React.useState(spot);
      const [record, setRecord] = React.useState(false);
      const [ghostEnabled, setGhostEnabled] = React.useState(() => {
        try { return window.localStorage.getItem(GHOST_ENABLED_KEY) !== 'false'; } catch { return true; }
      });
      const [ghostRun, setGhostRun] = React.useState(() => readGhost(window.localStorage, CLICK_TIME * 1000));
      const [ghostElapsed, setGhostElapsed] = React.useState(0);
      const [ghostNotice, setGhostNotice] = React.useState('');
      const clickRun = React.useRef({ start: null, hits: [] });
      const [tick, setTick] = useCountdown(phase, setPhase, () => setPhase('running'), 2);

      React.useEffect(() => {
        if (phase !== 'running') return undefined;
        const started = performance.now();
        clickRun.current.start = started;
        const id = window.setInterval(() => {
          const elapsed = performance.now() - started;
          setGhostElapsed(Math.min(CLICK_TIME * 1000, elapsed));
          const remain = CLICK_TIME - elapsed / 1000;
          if (remain <= 0) {
            window.clearInterval(id);
            setLeft(0);
            setPhase('done');
          } else setLeft(Math.ceil(remain));
        }, 120);
        return () => window.clearInterval(id);
      }, [phase]);

      React.useEffect(() => {
        if (phase !== 'done') return;
        setRecord(onFinish('click', hits) === true);
        const previous = readGhost(window.localStorage, CLICK_TIME * 1000);
        if (clickRun.current.hits.length > (previous?.hits.length || 0)) {
          const saved = saveGhost(window.localStorage, clickRun.current.hits, CLICK_TIME * 1000);
          setGhostNotice(saved ? 'ghostSaved' : 'ghostStorage');
        }
      }, [phase]);

      function start() {
        clickRun.current = { start: null, hits: [] };
        setGhostRun(readGhost(window.localStorage, CLICK_TIME * 1000));
        setGhostElapsed(0);
        setGhostNotice('');
        setHits(0);
        setShots(0);
        setLeft(CLICK_TIME);
        setPos(spot());
        setTick(2);
        setRecord(false);
        setPhase('countdown');
      }

      function hit(event) {
        event.stopPropagation();
        if (phase !== 'running' || clickRun.current.start === null) return;
        const elapsed = performance.now() - clickRun.current.start;
        if (elapsed < 0 || elapsed >= CLICK_TIME * 1000) return;
        clickRun.current.hits.push(elapsed);
        setGhostElapsed(elapsed);
        setHits((n) => n + 1);
        setShots((n) => n + 1);
        setPos(spot());
      }

      const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;
      const ghostHits = ghostScoreAt(ghostRun, ghostElapsed);
      const delta = hits - ghostHits;
      const ghostScale = Math.max(1, hits, ghostRun?.hits.length || 0);

      return h('div', null,
        h('div', { className: 'at-ghost-controls', style: { padding: '10px 14px' } },
          h('label', null,
            h('input', { type: 'checkbox', checked: ghostEnabled, disabled: phase === 'running' || phase === 'countdown',
              onChange: (event) => {
                const enabled = event.target.checked;
                setGhostEnabled(enabled);
                try { window.localStorage.setItem(GHOST_ENABLED_KEY, String(enabled)); } catch { /* session preference */ }
              } }), ' ', t('ghost')),
          h('div', { className: 'at-note' }, ghostEnabled ? t(ghostRun ? 'ghostHint' : 'ghostEmpty') : t('ghostHint')),
          ghostEnabled && ghostRun && h('div', { className: 'at-ghost-race' },
            h('div', null, `${t('you')}: ${hits} · ${t('ghost')}: ${ghostHits} · ${t('ghostBest')}: ${ghostRun.hits.length}`),
            h('label', { style: { display: 'block' } }, t('you'), ' ', h('progress', { value: hits, max: ghostScale, 'aria-label': t('you') })),
            h('label', { style: { display: 'block' } }, t('ghost'), ' ', h('progress', { value: ghostHits, max: ghostScale, 'aria-label': t('ghost') })),
            h('div', { className: 'at-note' }, delta === 0 ? t('ghostTied') : `${t(delta > 0 ? 'ghostAhead' : 'ghostBehind')} ${Math.abs(delta)}`)),
          ghostNotice && h('div', { className: 'at-note', role: 'status' }, t(ghostNotice)),
        ),
        h('div', { className: 'at-arena', onPointerDown: () => { if (phase === 'running') setShots((n) => n + 1); } },
          h('div', { className: 'at-grid' }),
          phase === 'running' && h('button', { type: 'button', className: 'at-target', style: { left: pos.x + '%', top: pos.y + '%' }, onPointerDown: hit, 'aria-label': t('hits') }),
          phase === 'countdown' && h('div', { key: tick, className: 'at-count' }, tick),
          phase === 'idle' && h('p', { className: 'at-hint' }, t('clickHint')),
          phase === 'done' && h('div', { className: 'at-flag' }, `${t('done')} · ${hits} ${t('hits')} · ${accuracy}%`),
        ),
        h('div', { className: 'at-stats' },
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('hits')), h('span', { className: 'at-stat-value' }, hits)),
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('accuracy')), h('span', { className: 'at-stat-value' }, accuracy + '%')),
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('timeLeft')), h('span', { className: 'at-stat-value' }, left + t('sec'))),
        ),
        h('p', { className: 'at-status', role: 'status', 'aria-live': 'polite' }, phase === 'countdown' ? t('ready') : phase === 'done' ? (record ? t('newRecord') : t('timeUp')) : t('clickHint')),
        h('div', { className: 'at-actions' }, h('button', { type: 'button', className: 'at-primary', onClick: start }, t(phase === 'idle' ? 'start' : 'again'))),
      );
    }

    function ReactionGame({ t, onFinish }) {
      const [phase, setPhase] = React.useState('idle');
      const [round, setRound] = React.useState(0);
      const [times, setTimes] = React.useState([]);
      const [pos, setPos] = React.useState(spot);
      const [early, setEarly] = React.useState(false);
      const [record, setRecord] = React.useState(false);
      const startAt = React.useRef(0);
      const [tick, setTick] = useCountdown(phase, setPhase, () => setPhase('wait'), 2);

      React.useEffect(() => {
        if (phase !== 'wait') return undefined;
        const delay = 800 + Math.random() * 1500;
        const id = window.setTimeout(() => {
          startAt.current = performance.now();
          setPos(spot());
          setEarly(false);
          setPhase('ready');
        }, delay);
        return () => window.clearTimeout(id);
      }, [phase, round]);

      const average = times.length > 0 ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;

      React.useEffect(() => {
        if (phase === 'done' && average > 0) setRecord(onFinish('reaction', average) === true);
      }, [phase]);

      function start() {
        setTimes([]);
        setRound(1);
        setEarly(false);
        setRecord(false);
        setTick(2);
        setPhase('countdown');
      }

      function hit(event) {
        event.stopPropagation();
        if (phase !== 'ready') return;
        const value = performance.now() - startAt.current;
        const next = times.concat(value);
        setTimes(next);
        if (next.length >= REACTION_ROUNDS) setPhase('done');
        else {
          setRound((n) => n + 1);
          setPhase('wait');
        }
      }

      return h('div', null,
        h('div', { className: 'at-arena', onPointerDown: () => { if (phase === 'wait') setEarly(true); } },
          h('div', { className: 'at-grid' }),
          phase === 'ready' && h('button', { type: 'button', className: 'at-target', style: { left: pos.x + '%', top: pos.y + '%' }, onPointerDown: hit, 'aria-label': t('now') }),
          phase === 'countdown' && h('div', { key: tick, className: 'at-count' }, tick),
          phase === 'idle' && h('p', { className: 'at-hint' }, t('reactionHint')),
          phase === 'wait' && h('p', { className: 'at-hint' }, early ? t('early') : t('ready')),
          phase === 'done' && h('div', { className: 'at-flag' }, `${t('done')} · ${average} ${t('ms')}`),
        ),
        h('div', { className: 'at-stats' },
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('round')), h('span', { className: 'at-stat-value' }, `${Math.min(round, REACTION_ROUNDS)}/${REACTION_ROUNDS}`)),
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('reaction')), h('span', { className: 'at-stat-value' }, times.length > 0 ? Math.round(times[times.length - 1]) + t('ms') : '—')),
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('accuracy')), h('span', { className: 'at-stat-value' }, average > 0 ? average + t('ms') : '—')),
        ),
        h('p', { className: 'at-status', role: 'status', 'aria-live': 'polite' }, phase === 'countdown' ? t('ready') : phase === 'done' ? (record ? t('newRecord') : t('reactionHint')) : t('reactionHint')),
        h('div', { className: 'at-actions' }, h('button', { type: 'button', className: 'at-primary', onClick: start }, t(phase === 'idle' ? 'start' : 'again'))),
      );
    }

    function TrackGame({ t, onFinish }) {
      const [phase, setPhase] = React.useState('idle');
      const [view, setView] = React.useState({ x: 50, y: 45, left: TRACK_TIME });
      const [accuracy, setAccuracy] = React.useState(0);
      const [record, setRecord] = React.useState(false);
      const arena = React.useRef(null);
      const [tick, setTick] = useCountdown(phase, setPhase, () => setPhase('running'), 2);

      React.useEffect(() => {
        if (phase !== 'running') return undefined;
        const node = arena.current;
        if (!node) return undefined;
        const rect = node.getBoundingClientRect();
        const radius = 28;
        let px = null;
        let py = null;
        let x = 50;
        let y = 45;
        let vx = 0.055;
        let vy = -0.041;
        let onTarget = 0;
        let total = 0;
        let last = performance.now();
        let frame = 0;

        const move = (event) => { px = event.clientX; py = event.clientY; };
        node.addEventListener('pointermove', move);

        const step = (now) => {
          const dt = Math.min(now - last, 60);
          last = now;
          total += dt;
          x += vx * dt;
          y += vy * dt;
          if (x <= 10 || x >= 90) { vx = -vx; x = Math.min(90, Math.max(10, x)); }
          if (y <= 14 || y >= 86) { vy = -vy; y = Math.min(86, Math.max(14, y)); }
          if (px !== null) {
            const cx = rect.left + (rect.width * x) / 100;
            const cy = rect.top + (rect.height * y) / 100;
            const dx = px - cx;
            const dy = py - cy;
            if (dx * dx + dy * dy <= radius * radius) onTarget += dt;
          }
          if (total >= TRACK_TIME * 1000) {
            setView({ x, y, left: 0 });
            setAccuracy(Math.round((onTarget / total) * 100));
            setPhase('done');
            return;
          }
          setView({ x, y, left: Math.ceil((TRACK_TIME * 1000 - total) / 1000) });
          frame = window.requestAnimationFrame(step);
        };
        frame = window.requestAnimationFrame(step);

        return () => {
          window.cancelAnimationFrame(frame);
          node.removeEventListener('pointermove', move);
        };
      }, [phase]);

      React.useEffect(() => {
        if (phase === 'done' && accuracy > 0) setRecord(onFinish('track', accuracy) === true);
      }, [phase]);

      return h('div', null,
        h('div', { className: 'at-arena', ref: arena },
          h('div', { className: 'at-grid' }),
          h('div', { className: 'at-target at-track-target', style: { left: view.x + '%', top: view.y + '%' }, 'aria-hidden': true }),
          phase === 'countdown' && h('div', { key: tick, className: 'at-count' }, tick),
          phase === 'idle' && h('p', { className: 'at-hint' }, t('trackHint')),
          phase === 'done' && h('div', { className: 'at-flag' }, `${t('done')} · ${accuracy}%`),
        ),
        h('div', { className: 'at-stats' },
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('accuracy')), h('span', { className: 'at-stat-value' }, accuracy + '%')),
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('timeLeft')), h('span', { className: 'at-stat-value' }, view.left + t('sec'))),
          h('div', { className: 'at-stat' }, h('span', { className: 'at-stat-label' }, t('track')), h('span', { className: 'at-stat-value' }, phase === 'running' ? 'LIVE' : '—')),
        ),
        h('p', { className: 'at-status', role: 'status', 'aria-live': 'polite' }, phase === 'countdown' ? t('ready') : phase === 'done' ? (record ? t('newRecord') : t('trackHint')) : t('trackHint')),
        h('div', { className: 'at-actions' },
          h('button', { type: 'button', className: 'at-primary', onClick: () => { setAccuracy(0); setRecord(false); setTick(2); setPhase('countdown'); } }, t(phase === 'idle' ? 'start' : 'again')),
        ),
      );
    }

    // ------------------------------------------------------------- multiplayer

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

    function statCell(label, value) {
      return h('div', { className: 'at-stat' },
        h('span', { className: 'at-stat-label' }, label),
        h('span', { className: 'at-stat-value' }, value),
      );
    }

    function DuelClick({ vs, t, seed, durationMs, startLocal }) {
      const targets = React.useMemo(() => buildTargets(seed, 320), [seed]);
      const stats = React.useRef({ hits: 0, misses: 0, index: 0 });
      const finishedRef = React.useRef(false);
      const reported = React.useRef(0);
      const [view, setView] = React.useState(() => ({ ...stats.current, left: Math.max(0, Math.ceil((startLocal + durationMs - Date.now()) / 1000)) }));
      const [done, setDone] = React.useState(false);

      React.useEffect(() => {
        const id = window.setInterval(() => {
          const remain = startLocal + durationMs - Date.now();
          setView((current) => ({ ...current, left: Math.max(0, Math.ceil(remain / 1000)) }));
          if (remain <= 0 && !finishedRef.current) {
            finishedRef.current = true;
            window.clearInterval(id);
            const { hits, misses } = stats.current;
            const shots = hits + misses;
            vs.act((room) => room.finish({
              score: hits,
              hits,
              misses,
              acc: shots > 0 ? Math.round((hits / shots) * 100) : 0,
            }));
            setDone(true);
          }
        }, 100);
        return () => window.clearInterval(id);
      }, [startLocal, durationMs]);

      function maybeReport(hits, misses) {
        const at = Date.now();
        if (at - reported.current < 250) return;
        reported.current = at;
        const shots = hits + misses;
        vs.act((room) => room.reportProgress({
          score: hits,
          hits,
          misses,
          acc: shots > 0 ? Math.round((hits / shots) * 100) : 0,
        }));
      }

      function hit(event) {
        event.stopPropagation();
        if (finishedRef.current) return;
        stats.current.hits += 1;
        stats.current.index += 1;
        const { hits, misses, index } = stats.current;
        setView((current) => ({ ...current, hits, misses, index }));
        maybeReport(hits, misses);
      }

      function miss() {
        if (finishedRef.current) return;
        stats.current.misses += 1;
        setView((current) => ({ ...current, misses: stats.current.misses }));
      }

      const target = targets[view.index % targets.length];
      const shots = view.hits + view.misses;

      return h('div', { className: 'at-duel' },
        h('div', { className: 'at-arena', onPointerDown: miss },
          h('div', { className: 'at-grid' }),
          !done && h('button', {
            type: 'button',
            className: 'at-target',
            style: { left: target.x * 100 + '%', top: target.y * 100 + '%' },
            onPointerDown: hit,
            'aria-label': t('hits'),
          }),
          done && h('div', { className: 'at-flag' }, t('done')),
        ),
        h('div', { className: 'at-stats' },
          statCell(t('you'), view.hits),
          statCell(t('accuracy'), (shots ? Math.round(view.hits / shots * 100) : 0) + '%'),
          statCell(t('timeLeft'), view.left + t('sec')),
        ),
      );
    }

    function DuelReaction({ vs, t, seed, rounds }) {
      const spots = React.useMemo(() => buildTargets(seed ^ 0x5bf03635, rounds + 6), [seed, rounds]);
      const delays = React.useMemo(() => {
        const next = mulberry32(seed);
        const out = [];
        for (let index = 0; index < rounds; index += 1) out.push(700 + next() * 1300);
        return out;
      }, [seed, rounds]);
      const [stage, setStage] = React.useState('wait');
      const [round, setRound] = React.useState(1);
      const [times, setTimes] = React.useState([]);
      const [early, setEarly] = React.useState(false);
      const [done, setDone] = React.useState(false);
      const startAt = React.useRef(0);
      const spot = spots[(round - 1) % spots.length];

      React.useEffect(() => {
        if (stage !== 'wait' || done) return undefined;
        const id = window.setTimeout(() => {
          startAt.current = performance.now();
          setEarly(false);
          setStage('ready');
        }, delays[round - 1]);
        return () => window.clearTimeout(id);
      }, [stage, round, done]);

      function hit(event) {
        event.stopPropagation();
        if (stage !== 'ready') return;
        const value = performance.now() - startAt.current;
        const next = times.concat(value);
        setTimes(next);
        const average = Math.round(next.reduce((sum, item) => sum + item, 0) / next.length);
        vs.act((room) => room.reportProgress({ score: average, hits: next.length, misses: 0, acc: 0 }));
        if (next.length >= rounds) {
          setDone(true);
          vs.act((room) => room.finish({ score: average, hits: next.length, misses: 0, acc: 0 }));
        } else {
          setRound((count) => count + 1);
          setStage('wait');
        }
      }

      const last = times.length > 0 ? Math.round(times[times.length - 1]) : 0;
      const average = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;

      return h('div', { className: 'at-duel' },
        h('div', {
          className: 'at-arena',
          onPointerDown: () => { if (stage === 'wait' && !done) setEarly(true); },
        },
          h('div', { className: 'at-grid' }),
          stage === 'ready' && h('button', {
            type: 'button',
            className: 'at-target',
            style: { left: spot.x * 100 + '%', top: spot.y * 100 + '%' },
            onPointerDown: hit,
            'aria-label': t('now'),
          }),
          stage === 'wait' && h('p', { className: 'at-hint' }, early ? t('early') : t('ready')),
          done && h('div', { className: 'at-flag' }, t('done')),
        ),
        h('div', { className: 'at-stats' },
          statCell(t('round'), `${Math.min(round, rounds)}/${rounds}`),
          statCell(t('reaction'), last > 0 ? last + t('ms') : '—'),
          statCell(t('reactionBest'), average > 0 ? average + t('ms') : '—'),
        ),
      );
    }

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

    function VersusPanel({ vs, t }) {
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
            ? h(DuelReaction, { key: snap.matchId, vs, t, seed: snap.seed, rounds: snap.rounds || 8 })
            : h(DuelClick, { key: snap.matchId, vs, t, seed: snap.seed, durationMs: snap.durationMs || 30000, startLocal }),
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
          h('button', { className: 'at-primary', type: 'button', onClick: () => vs.act((room) => room.setReady(!ready)) }, ready ? t('unready') : t('ready')),
          h('button', {
            className: 'at-primary',
            type: 'button',
            disabled: snap.role !== 'host' || !allReady,
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

        function setPos(next) {
          posRef.current = next;
          setPosState(next);
        }

        React.useEffect(() => ctx.locale.subscribe(() => bump((n) => n + 1)), []);
        React.useEffect(() => {
          if (!open) return undefined;
          const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
          window.addEventListener('keydown', onKey);
          return () => window.removeEventListener('keydown', onKey);
        }, [open]);

        React.useEffect(() => {
          if (!open) return undefined;
          const onResize = () => {
            const node = winRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            setPos(clampToViewport(posRef.current.left, posRef.current.top, rect.width, rect.height));
          };
          window.addEventListener('resize', onResize);
          return () => window.removeEventListener('resize', onResize);
        }, [open]);

        function grab(event) {
          if (event.button !== 0) return;
          const node = winRef.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          grabRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }

        function drag(event) {
          if (!grabRef.current) return;
          const node = winRef.current;
          if (!node) return;
          const rect = node.getBoundingClientRect();
          setPos(clampToViewport(event.clientX - grabRef.current.dx, event.clientY - grabRef.current.dy, rect.width, rect.height));
        }

        function drop(event) {
          if (!grabRef.current) return;
          grabRef.current = null;
          setDragging(false);
          try { window.localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch (_) { /* Position resets next session. */ }
          if (event) event.currentTarget.releasePointerCapture?.(event.pointerId);
        }

        function centre() {
          const node = winRef.current;
          const width = node ? node.getBoundingClientRect().width : WIDTH;
          setPos({ left: Math.max(8, Math.round((window.innerWidth - width) / 2)), top: 76 });
          try { window.localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch (_) { /* Ignore. */ }
        }

        function record(kind, value) {
          if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) return false;
          const previous = records[kind];
          const lowerIsBetter = kind === 'reaction';
          const better = previous === null || (lowerIsBetter ? value < previous : value > previous);
          if (!better) return false;
          const next = { ...records, [kind]: value };
          setRecords(next);
          try { window.localStorage.setItem(REC_KEY, JSON.stringify(next)); } catch (_) { /* Session-only record. */ }
          return true;
        }

        const row = (label, value, unit) => h('div', { className: 'at-record' },
          h('span', null, label),
          value === null ? h('strong', { className: 'at-empty' }, t('noRecord')) : h('strong', null, unit ? `${value} ${unit}` : `${value}`),
        );

        return h('div', { className: 'at-root' },
          h('style', null, CSS),
          h('button', { type: 'button', className: 'at-launch', title: t(open ? 'close' : 'open'), 'aria-label': t(open ? 'close' : 'open'), 'aria-expanded': open, onClick: () => setOpen(!open) }, '🎯'),
          (open || vs.stage === 'room') && h('section', {
            className: 'at-win',
            ref: winRef,
            style: { left: pos.left + 'px', top: pos.top + 'px', display: open ? 'flex' : 'none' },
            'aria-label': t('title'),
          },
            h('div', {
              className: 'at-bar' + (dragging ? ' at-drag' : ''),
              onPointerDown: grab,
              onPointerMove: drag,
              onPointerUp: drop,
              onPointerCancel: drop,
              title: t('drag'),
            },
              h('span', { className: 'at-dot' }),
              h('span', { className: 'at-name' }, t('title')),
              h('span', { className: 'at-spacer' }),
              h('button', { className: 'at-ico', type: 'button', title: t('center'), 'aria-label': t('center'), onPointerDown: (e) => e.stopPropagation(), onClick: centre }, '⌖'),
              h('button', { className: 'at-ico', type: 'button', title: t('close'), 'aria-label': t('close'), onPointerDown: (e) => e.stopPropagation(), onClick: () => setOpen(false) }, '×'),
            ),
            h('div', { className: 'at-tabs', role: 'tablist', 'aria-label': t('title') },
              h('button', { className: 'at-tab', role: 'tab', type: 'button', 'aria-selected': tab === 'train', onClick: () => setTab('train') }, t('trainTab')),
              h('button', { className: 'at-tab', role: 'tab', type: 'button', 'aria-selected': tab === 'versus', onClick: () => setTab('versus') }, t('versusTab')),
              h('button', { className: 'at-tab', role: 'tab', type: 'button', 'aria-selected': tab === 'records', onClick: () => setTab('records') }, t('recordTab')),
            ),
            h('div', { style: { display: tab === 'train' ? 'block' : 'none' } },
              h('div', { className: 'at-modes' },
                ['click', 'reaction', 'track'].map((key) =>
                  h('button', { key, type: 'button', className: 'at-mode', 'aria-pressed': mode === key, onClick: () => setMode(key) }, t(key)),
                ),
              ),
              mode === 'click' && h(ClickGame, { key: 'click', t, onFinish: record }),
              mode === 'reaction' && h(ReactionGame, { key: 'reaction', t, onFinish: record }),
              mode === 'track' && h(TrackGame, { key: 'track', t, onFinish: record }),
            ),
            h('div', { style: { display: tab === 'versus' ? 'block' : 'none' } }, h(VersusPanel, { vs, t })),
            tab === 'records' ? h('div', { className: 'at-records' },
              row(t('clickBest'), records.click, ''),
              row(t('reactionBest'), records.reaction, t('ms')),
              row(t('trackBest'), records.track, '%'),
            ) : null,
          ),
        );
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
  