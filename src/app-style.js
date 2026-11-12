export const APP_CSS = `
.at-root { --ar-bg:#171b1e; --ar-panel:#1e2428; --ar-line:#343c42; --ar-text:#e7edef; --ar-muted:#929fa7; --ar-accent:#48d2d7; font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif; }
.at-win { isolation:isolate; container-type:inline-size; border:1px solid #394249; border-radius:12px; background:var(--ar-bg); color:var(--ar-text); box-shadow:0 28px 100px #0009; overflow:hidden; }
.at-win button,.at-win input,.at-win select { font-family:inherit; }
.at-win button { -webkit-tap-highlight-color:transparent; }
.at-win button:focus-visible,.at-win input:focus-visible,.at-win select:focus-visible { outline:2px solid var(--ar-accent); outline-offset:3px; }
.at-win button:disabled { opacity:.4; cursor:not-allowed; }
.at-bar { min-height:62px; padding:0 20px; background:#20262a; border-bottom:1px solid var(--ar-line); gap:14px; }
.at-brand { display:flex; align-items:center; gap:10px; flex-shrink:0; color:#f3f6f7; }
.at-brand svg { width:30px; height:30px; color:var(--ar-accent); }
.at-brand b { font-size:16px; letter-spacing:-.04em; }
.at-brand small { color:#a7b3ba; font-size:9px; letter-spacing:.22em; display:block; margin-top:3px; }
.at-name { font-size:11px; color:var(--ar-muted); letter-spacing:.14em; }
.at-app-nav { align-self:stretch; display:flex; gap:2px; margin-left:22px; }
.at-app-nav .at-tab { position:relative; flex:none; padding:0 18px; background:none; color:#9da9b0; border-radius:0; font-size:12px; letter-spacing:.02em; }
.at-app-nav .at-tab[aria-selected="true"] { background:none; color:var(--ar-accent); }
.at-app-nav .at-tab[aria-selected="true"]:after { position:absolute; content:''; bottom:0; left:18px; right:18px; height:3px; background:var(--ar-accent); }
.at-app-nav .at-tab:hover { color:#e8edef; }
.at-ico { color:#a7b3ba; border-color:#465159; border-radius:5px; width:28px; height:28px; background:none; }
.at-version { color:#82929b; font-size:10px; letter-spacing:.08em; }
.at-content { min-height:0; flex:1; overflow:auto; background:radial-gradient(ellipse at 80% 0,#29323844,transparent 60%),#171b1e; scrollbar-color:#47545d #1b2024; }
.at-training-shell { min-height:100%; display:grid; grid-template-columns:205px minmax(0,1fr); }
.at-sidebar { background:#1b2024; border-right:1px solid #30393f; padding:25px 14px; }
.at-side-label { padding:0 13px; margin:4px 0 14px; color:#788891; font-size:9px; font-weight:700; letter-spacing:.18em; }
.at-modes { display:flex; flex-direction:column; gap:5px; padding:0; }
.at-mode { position:relative; display:flex; gap:11px; align-items:center; text-align:left; min-height:68px; padding:12px; border-radius:6px; border:1px solid transparent; background:transparent; color:#bac4ca; font-size:12px; letter-spacing:0; }
.at-mode svg { width:24px; height:24px; flex-shrink:0; color:#7c909a; }
.at-mode small { display:block; color:#7f909a; font-size:10px; margin-top:6px; font-weight:400; }
.at-mode[aria-pressed="true"] { background:#2b373d; color:#fff; border-color:#3e5d64; box-shadow:none; }
.at-mode[aria-pressed="true"] svg { color:var(--ar-accent); }
.at-mode[aria-pressed="true"]:before { content:''; position:absolute; left:-15px; top:15px; bottom:15px; width:3px; background:var(--ar-accent); }
.at-mode:hover { background:#283138; }
.at-side-bottom { margin:30px 12px; padding-top:22px; border-top:1px solid #343d43; }
.at-side-bottom strong { display:block; color:#9dafb8; font-size:11px; }
.at-side-bottom p { color:#70838f; font-size:10px; line-height:1.8; margin:8px 0; }
.at-main-training { min-width:0; padding:28px 30px; }
.at-breadcrumb { display:flex; align-items:center; gap:9px; margin-bottom:16px; color:#82929a; font-size:10px; letter-spacing:.12em; }
.at-breadcrumb span:last-child { color:#c2cdd2; }
.at-footer { min-height:30px; padding:0 12px 0 20px; color:#778a96; background:#1b2024; border-top:1px solid #313a40; letter-spacing:.025em; }
.at-footer .at-resize { color:#778a96; }
.at-primary { background:#49d4d9; color:#10282d; border:1px solid #49d4d9; border-radius:5px; padding:13px 24px; font-size:12px; line-height:1.4; letter-spacing:.01em; font-weight:750; cursor:pointer; min-height:43px; }
.at-primary:hover { background:#78e5e8; border-color:#78e5e8; }
.ar-secondary,.at-ghost { border:1px solid #48545d; background:#242c31; color:#d5dfe4; border-radius:5px; padding:12px 20px; font-size:12px; line-height:1.4; cursor:pointer; }
.ar-secondary:hover,.at-ghost:hover { background:#303c43; border-color:#6b7b85; }
.ar-eyebrow { color:#90a3ad; font-size:9px; line-height:1.5; font-weight:650; letter-spacing:.18em; }
.ar-range { min-width:0; }
.ar-range .ar-scene { height:clamp(280px,43vh,520px); min-height:240px; margin:0; border-radius:8px; border:1px solid #435057; position:relative; overflow:hidden; background:#303940; }
.ar-canvas { width:100%; height:100%; display:block; outline:none; }
.ar-hero-text { position:absolute; left:28px; top:25px; pointer-events:none; text-shadow:0 2px 20px #0009; }
.ar-hero-text h1 { font-size:clamp(28px,4vw,48px); line-height:1.1; font-weight:750; letter-spacing:-.035em; margin:12px 0; color:#f2f7f9; }
.ar-hero-text p { font-size:11px; color:#b3c5cd; line-height:1.8; max-width:330px; margin:0; }
.ar-scene-badge { position:absolute; top:22px; right:22px; font-size:9px; color:#b8d1d8; letter-spacing:.16em; padding:8px 10px; border:1px solid #819ca533; background:#121e2455; border-radius:4px; }
.ar-task-info { display:flex; align-items:center; gap:24px; padding:22px 0; border-bottom:1px solid #343d43; }
.ar-task-info>div:first-child { flex:1; }
.ar-task-info h2 { margin:5px 0 7px; font-size:20px; font-weight:650; letter-spacing:-.025em; }
.ar-task-info p { margin:0; color:#8c9da7; font-size:11px; line-height:1.8; }
.ar-task-duration { display:flex; align-items:baseline; gap:6px; padding:0 22px; border-left:1px solid #3d484e; }
.ar-task-duration strong { font-size:28px; font-weight:500; }
.ar-task-duration span { color:#879da8; font-size:10px; }
.ar-start { min-width:150px; }
.ar-task-notes { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:22px; }
.ar-panel { border:1px solid #354148; background:linear-gradient(135deg,#242d32,#20262a); border-radius:7px; padding:22px; }
.ar-task-notes .ar-panel { position:relative; padding:19px 18px 16px 52px; }
.ar-task-notes strong { font-size:11px; font-weight:600; }
.ar-task-notes p { margin:8px 0 0; color:#8196a1; font-size:10px; line-height:1.9; }
.ar-note-icon { position:absolute; top:18px; left:18px; color:#66c6cc; font-size:21px; }
.ar-range-play,.ar-range-result { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; background:#161d21; }
.ar-range-play .ar-scene,.ar-range-result .ar-scene { flex:1; height:100%; min-height:0; border:none; border-radius:0; }
.ar-hud { display:flex; position:absolute; top:0; left:0; right:0; align-items:center; justify-content:center; gap:1px; padding:20px 28px; pointer-events:none; background:linear-gradient(#0e161c88,transparent); }
.ar-hud-name { margin-right:auto; min-width:145px; }
.ar-hud-name strong { display:block; font-size:15px; font-weight:650; }
.ar-hud-name>span { display:block; font-size:8px; letter-spacing:.2em; color:#a7bbc5; margin-top:6px; }
.ar-hud-stat { min-width:125px; padding:9px 24px; text-align:left; font-variant-numeric:tabular-nums; }
.ar-hud .ar-hud-stat { background:#14212a55; border:1px solid #8aa4b044; margin-right:5px; border-radius:4px; }
.ar-hud-stat>span { display:block; text-transform:uppercase; color:#a2b9c6; font-size:9px; letter-spacing:.12em; margin-bottom:5px; }
.ar-hud-stat strong { font-size:25px; color:#f6fafc; font-weight:550; letter-spacing:-.025em; }
.ar-hud-pause { margin-left:auto; margin-right:0; background:#14212a66; color:#bcd0d9; border:1px solid #8aa4b055; border-radius:5px; padding:10px 12px; pointer-events:auto; cursor:pointer; }
.ar-crosshair { position:absolute; left:50%; top:50%; width:18px; height:18px; transform:translate(-50%,-50%); pointer-events:none; filter:drop-shadow(0 0 1px #000); }
.ar-crosshair.cross:before,.ar-crosshair.cross:after { content:''; position:absolute; background:#e1fff7; }
.ar-crosshair.cross:before { width:2px; height:14px; left:8px; top:2px; }
.ar-crosshair.cross:after { height:2px; width:14px; left:2px; top:8px; }
.ar-crosshair.dot { width:4px; height:4px; border-radius:50%; background:#d9fff5; box-shadow:0 0 0 1px #14242a; }
.ar-crosshair.ring { width:15px; height:15px; border:2px solid #d9fff5; border-radius:50%; }
.ar-countdown { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:15px; pointer-events:none; }
.ar-countdown>span { letter-spacing:.25em; font-size:12px; color:#d2e4eb; }
.ar-countdown strong { font-size:100px; line-height:1; color:white; font-weight:400; text-shadow:0 5px 50px #0008; }
.ar-game-help { position:absolute; bottom:25px; left:28px; color:#adc0c9; font-size:10px; letter-spacing:.06em; }
.ar-online-progress { position:absolute; top:120px; left:28px; width:230px; pointer-events:none; padding:8px 12px; border:1px solid #a9c3d333; border-radius:5px; background:#14232b99; }
.ar-online-progress .at-players { gap:4px; }
.ar-online-progress .at-player { padding:5px 7px; min-height:0; border:0; background:transparent; font-size:10px; }
.ar-online-progress .at-player-value { font-size:11px; }
.ar-ghost-strip { position:absolute; bottom:23px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:18px; padding:10px 20px; border:1px solid #9fb3bd33; background:#12202b88; border-radius:4px; font-size:10px; color:#bfd2df; }
.ar-ghost-strip strong { color:white; font-size:15px; }
.ar-reaction-wait { position:absolute; top:36%; left:50%; transform:translateX(-50%); color:#d0dfe7; font-size:13px; pointer-events:none; }
.ar-pause-overlay { position:absolute; inset:0; background:#091118bb; backdrop-filter:blur(8px); display:grid; place-items:center; z-index:3; }
.ar-pause-card { width:min(460px,90%); padding:40px; border:1px solid #4c5e68; border-radius:9px; background:#1c272fef; text-align:center; box-shadow:0 30px 70px #0005; }
.ar-pause-card h2 { font-size:32px; font-weight:600; margin:18px 0 12px; }
.ar-pause-card p { color:#98afbc; font-size:12px; line-height:1.8; }
.ar-pause-card button { display:block; width:100%; margin-top:12px; }
.ar-error { margin:12px 0; color:#ffb496; font-size:12px; line-height:1.7; padding:10px 14px; background:#78351d33; border-radius:4px; }
.ar-results { position:absolute; inset:0; overflow:auto; padding:38px 5%; background:linear-gradient(115deg,#171f25f9,#1d282ef5); }
.ar-result-top h2 { color:#b3c6d1; font-size:17px; margin:10px 0; font-weight:500; }
.ar-result-score { font-size:72px; font-weight:600; color:#88e9e8; line-height:1.2; letter-spacing:-.04em; }
.ar-result-score small { font-size:15px; margin-left:14px; color:#8faebd; letter-spacing:0; font-weight:400; }
.ar-result-stats { display:flex; gap:10px; border-top:1px solid #38464f; border-bottom:1px solid #38464f; margin:22px 0; padding:12px 0; }
.ar-result-stats .ar-hud-stat { flex:1; padding-left:0; }
.ar-result-charts { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.ar-panel h3 { margin:0 0 14px; font-size:12px; font-weight:500; color:#c2d0d8; }
.ar-trend { display:block; height:130px; width:100%; overflow:visible; }
.ar-chart-empty { height:130px; display:grid; place-items:center; color:#677b88; }
.ar-result-actions { display:flex; gap:12px; justify-content:flex-end; align-items:center; margin-top:25px; }
.ar-result-actions>span { margin-right:auto; }
.ar-muted { font-size:11px; line-height:1.8; color:#8ca1af; }
.ar-settings-page { max-width:900px; margin:auto; padding:40px; }
.ar-page-heading { margin-bottom:28px; }
.ar-page-heading h2 { font-size:30px; margin:10px 0; letter-spacing:-.03em; }
.ar-page-heading p { margin:0; color:#8ca1af; font-size:12px; line-height:1.8; }
.ar-settings { padding:26px; background:#20282e; border:1px solid #37454f; border-radius:8px; }
.ar-section-label { font-size:10px; letter-spacing:.15em; color:#78d7dc; margin:2px 0 24px; padding-top:15px; }
.ar-setting { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; margin-bottom:24px; font-size:12px; color:#c6d3dc; }
.ar-setting strong { color:#89cbd1; font-size:11px; font-variant-numeric:tabular-nums; }
.ar-setting input { grid-column:1/-1; width:100%; accent-color:#49d4d9; cursor:pointer; }
.ar-setting select { background:#172128; color:#c6d3dc; border:1px solid #4b616f; border-radius:4px; padding:8px; }
.ar-toggle { display:flex; justify-content:space-between; align-items:center; font-size:12px; margin:18px 0; color:#c6d3dc; }
.ar-toggle input { accent-color:#49d4d9; width:17px; height:17px; }
.ar-record-page { padding:34px 40px; }
.ar-record-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
.ar-best-number { display:block; font-size:42px; color:#c9f2f2; font-weight:500; margin:18px 0; }
.ar-best-number small { font-size:15px; color:#809cae; }
.ar-history { margin-top:25px; }
.ar-history table { width:100%; border-collapse:collapse; text-align:left; font-size:11px; }
.ar-history th { color:#7896a9; font-weight:500; padding:10px 8px; }
.ar-history td { padding:12px 8px; border-top:1px solid #394851; color:#b5c8d3; }
.ar-legacy { padding:20px 0; font-size:10px; color:#6d8a9b; line-height:1.8; }
.ar-empty-records { text-align:center; padding:40px; margin-top:24px; color:#8ca5b3; }
.ar-empty-records>span { font-size:35px; color:#52cbd2; }
.ar-empty-records h3 { margin:15px 0; }
.ar-empty-records p { font-size:12px; }
.at-vs { max-width:880px; margin:0 auto; padding:30px; gap:15px; }
.at-vs:has(.ar-range-play) { position:static; }
.at-input { background:#222d35; border-color:#435866; color:#d0e1eb; padding:12px; border-radius:5px; min-height:42px; }
.at-label,.at-note,.at-status,.at-record { color:#8fa6b5; }
.at-player,.at-codebox,.at-duel-line,.at-banner { background:#232e36; border-color:#3b515e; color:#ccdde7; border-radius:6px; }
.at-player-name,.at-player-value,.at-code,.at-record strong,.at-duel-line strong { color:#dae7ed; }
.at-chip { border-color:#3f6169; color:#9ebbc9; }
.at-chip.at-on { color:#76e7ce; }
.at-modes.at-two { display:grid; grid-template-columns:1fr 1fr; }
.at-modes.at-two .at-mode { display:block; text-align:center; min-height:44px; }
.at-launch { background:#202a31; border-color:#43545e; color:#6fe0e1; }
@container (max-width:900px) {
 .at-training-shell { grid-template-columns:165px minmax(0,1fr); }
 .at-main-training { padding:20px; }
 .at-sidebar { padding:20px 9px; }
 .at-app-nav { margin-left:8px; }
 .at-app-nav .at-tab { padding:0 11px; }
 .at-brand b { font-size:14px; }
 .ar-task-duration { display:none; }
 .ar-task-notes { gap:10px; }
 .ar-hud-name { min-width:100px; }
 .ar-hud-stat { min-width:90px; padding:8px 15px; }
 .ar-record-page { padding:25px; }
}
@container (max-width:620px) {
 .at-bar { padding:0 10px; gap:6px; min-height:54px; }
 .at-brand svg { width:23px; height:23px; }
 .at-brand b { font-size:12px; }
 .at-brand small,.at-version,.at-side-bottom,.ar-scene-badge,.ar-task-notes { display:none; }
 .at-app-nav { margin-left:0; }
 .at-app-nav .at-tab { padding:0 7px; font-size:10px; min-height:50px; }
 .at-app-nav .at-tab[aria-selected="true"]:after { left:7px; right:7px; }
 .at-bar .at-ico { width:23px; height:23px; }
 .at-training-shell { grid-template-columns:1fr; }
 .at-sidebar { border-right:0; border-bottom:1px solid #343d43; padding:12px; }
 .at-side-label { display:none; }
 .at-modes { flex-direction:row; }
 .at-mode { flex:1; min-height:50px; padding:8px; font-size:10px; justify-content:center; }
 .at-mode svg,.at-mode small,.at-mode[aria-pressed="true"]:before { display:none; }
 .at-main-training { padding:16px; }
 .ar-range .ar-scene { height:260px; }
 .ar-range-play .ar-scene,.ar-range-result .ar-scene { height:100%; }
 .ar-hero-text { left:20px; top:22px; }
 .ar-hero-text h1 { font-size:32px; }
 .ar-hero-text p { max-width:230px; font-size:10px; }
 .ar-task-info { gap:10px; padding:18px 0; }
 .ar-task-info h2 { font-size:17px; }
 .ar-task-info p { font-size:10px; }
 .ar-start { min-width:110px; padding:12px 14px; }
 .ar-hud { gap:0; padding:12px 10px; }
 .ar-hud-name { display:none; }
 .ar-hud-stat { min-width:72px; flex:1; padding:8px 12px; }
 .ar-hud-stat strong { font-size:22px; }
 .ar-hud-stat>span { font-size:8px; }
 .ar-hud-pause { margin-left:5px; }
 .ar-game-help { left:15px; bottom:15px; }
 .ar-online-progress { top:93px; left:15px; width:180px; padding:5px 8px; }
 .ar-ghost-strip { bottom:45px; white-space:nowrap; padding:8px 12px; }
 .ar-results { padding:28px 20px; }
 .ar-result-score { font-size:55px; }
 .ar-result-charts { gap:12px; }
 .ar-result-charts .ar-panel { padding:14px; }
 .ar-trend,.ar-chart-empty { height:90px; }
 .ar-result-stats { gap:0; }
 .ar-result-stats .ar-hud-stat { padding:8px 4px; min-width:0; }
 .ar-result-stats .ar-hud-stat strong { font-size:20px; }
 .ar-result-actions { flex-wrap:wrap; }
 .ar-result-actions>span { flex-basis:100%; }
 .ar-record-grid { grid-template-columns:1fr; }
 .ar-settings-page,.ar-record-page { padding:22px 16px; }
 .ar-history { overflow:auto; }
 .at-footer { font-size:8px; }
}
@container (max-width:420px) {
 .at-brand b { display:none; }
 .at-brand { gap:0; }
 .at-bar { gap:4px; }
 .at-app-nav .at-tab { padding:0 6px; }
}
@media(prefers-reduced-motion:reduce) { .at-win * { scroll-behavior:auto; } }
`;
