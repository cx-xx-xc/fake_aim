# Aim Trainer 2.0 for DeepSeek Harness

在 DeepSeek Harness Web UI 中进行真实三维瞄准训练：灰色网格靶场、带光照的青色球靶、固定中央准星和三维手枪。鼠标转动视角，左键射击；提供三种单人训练、独立成绩页和 2～5 人房间对战。

A native WebGL aim trainer for DeepSeek Harness, with mouse-look controls, three solo drills, local records and ghost runs, and room-code matches for 2–5 players.

## 功能

| 模式 | 玩法 | 单人时长 | 成绩 |
| --- | --- | --- | --- |
| 点击 / GRIDSHOT | 同时显示三个球靶，击中后替换对应目标 | 30 秒 | 命中数，越高越好 |
| 反应 / REFLEX SHOT | 等球靶出现后移动视角并射击 | 8 轮 | 平均反应时间，越低越好 |
| 跟枪 / SPHERE TRACK | 持续让中央准星保持在移动球靶内 | 20 秒 | 有效瞄准时间占比，越高越好 |

- 默认以接近全屏的应用窗口打开，可还原为浮窗、拖动和缩放；位置与尺寸保存在本机。
- 顶部导航切换训练、对战、记录与设置，左侧选择训练项目。插件使用独立深色样式，不跟随宿主浅色主题。
- 单人结束后展示成绩、命中率、命中 / 射击数或瞄准时间、趋势图，以及重试和返回入口。
- 三维成绩与旧二维成绩分开保存；最近 100 次完整单人训练用于历史记录，个人最佳成绩另行持久保存。
- 点击训练可与自己最佳完整三维训练的幽灵节奏竞速；支持中文与英文。
- 原生 WebGL、程序生成几何体与音效，生产插件不下载三维素材或渲染库。

## 安装

需要提供插件客户端接口的 DeepSeek Harness 桌面端或 Web 端，以及支持 WebGL 和 Pointer Lock 的鼠标、键盘环境。具体兼容条件见下文。

### 从 GitHub 安装

在 Harness 的 **设置 → 插件 → 安装** 中填入：

```text
github:cx-xx-xc/fake_aim
```

也可使用完整地址：

```text
https://github.com/cx-xx-xc/fake_aim
```

这是 Cordis bundle，安装后注册到 `shell.overlay` 插槽，无需手动修改配置文件。

### 本地链接安装

```bash
git clone https://github.com/cx-xx-xc/fake_aim.git
```

在插件管理器中使用克隆目录的绝对路径：

```text
link:<克隆到的绝对路径>
```

本地开发修改 `src/` 或 `net/` 后，先运行 `node tools/build-client.mjs` 生成 `client.js`，再刷新 Harness。

## 使用与操作

1. 点击浮动靶心启动按钮打开训练应用；首次默认接近全屏。标题栏 `⛶` 放大 / 还原，`⌖` 居中；拖动标题栏移动窗口，拖动右下角调整尺寸。
2. 选择训练项目，点击「开始」。浏览器捕获鼠标后，单人训练显示 3 秒倒计时；需要继续时也要点击「继续训练」重新捕获鼠标。
3. 移动鼠标转动三维视角，让球靶进入固定中央准星。点击、反应训练按左键射击；跟枪训练保持瞄准即可。
4. 按 **Esc** 释放鼠标。单人训练会暂停，暂停期间不消耗倒计时或训练时间；点击继续恢复。收起窗口、切换插件页面或隐藏浏览器标签时，单人也会暂停。
5. 联机释放鼠标、收起窗口或隐藏页面时，**比赛仍按实际时间继续**；返回后显示当前进度。退出联机请使用「离开房间」。

聚焦训练窗口后可按 **空格** 触发可用的开始按钮；输入框、下拉框和按钮保留各自键盘行为。训练外按 Esc 可以收起窗口。

「设置」适用于全部三维训练并保存在当前浏览器：

| 设置 | 单位 / 默认值 |
| --- | --- |
| 鼠标灵敏度 | 视角度数 / 鼠标像素，默认 `0.16 °/px` |
| 视野 FOV | **垂直**视角，默认 `80°`，可调 `60–110°` |
| 准星 | 十字、圆点或圆环 |
| 枪械、射击特效 | 默认开启 |
| 音效 | **默认关闭**；开启后由 WebAudio 实时合成 |
| 幽灵对手 | 默认开启，仅用于单人点击训练 |

系统启用「减少动态效果」时，枪械摆动与后坐力动画会减少。音频不可用时仍可进行训练。

幽灵保存完整点击训练的命中时间轴，下局显示你与幽灵的实时比分和差距。只在完整结束且命中数更高时更新，同分保留原记录；中途退出不会覆盖。关闭幽灵显示仍会记录完整成绩。球靶位置每局重新生成，幽灵比较的是命中节奏；旧二维幽灵不会混入三维记录。

## 联机对战

对战使用公共 MQTT broker：`broker.emqx.io`，备用 `broker.hivemq.com`。无需注册账号或部署服务器。

1. 在「对战」页填写昵称，由一人创建房间。
2. 复制并发送**完整邀请码**，例如 `7K3Q9F-E`。末尾 `E` 表示 EMQX，`H` 表示 HiveMQ；同一个 6 位主体在不同中继上是不同房间。
3. 朋友粘贴整串邀请码加入。房间支持 2～5 人，所有在线玩家（含房主）都需准备。
4. 房主选择点击或反应模式。点击对战使用单靶共享序列；反应赛可选择 **5～20 轮**，默认 8 轮。全员准备后房主开始。
5. 玩家使用相同种子生成目标序列，并同步开局时间。结束后展示全员排名，点击命中数越多越好，反应平均时间越短越好，同分并列。中途退出者标记为退出，不参与有效名次。
6. 结算后可返回房间重新准备或离开。至少两人在线且准备时，房主可再次开局；客人可以请求再来一局。

带 `E` / `H` 的邀请码只连接指定中继，失败时明确提示；只含 6 位字符的旧式邀请码仍会依次尝试两个中继。公共 broker 的可用性和延迟受网络环境影响，连接失败时可重试。

**所有玩家必须使用相同应用版本。2.0.0 的三维规则不能与 1.x 二维客户端混玩；更新后请重新创建房间。** 比赛开始后不接受新玩家，返回大厅后可以再加入。

## 更新

GitHub 安装不会随仓库推送自动更新。在 Harness 的插件详情页点击「检查更新」，可查看当前版本和 GitHub 最新版本，并复制固定到目标提交的安装地址。检查仅在点击时联网，不会自动安装。

需要更新时移除旧插件，再安装：

```text
github:cx-xx-xc/fake_aim#main
```

刷新页面；宿主要求重启时重启 Harness。关闭插件开关只会禁用插件，不会更新。插件移除操作不会主动清除浏览器里的训练记录。本地链接安装可在克隆目录执行 `git pull`，重新构建 `client.js` 后刷新。

## 数据与隐私

三维数据保存在当前浏览器的 `localStorage`，不与旧二维成绩合并：

| 键 | 内容 |
| --- | --- |
| `aim-trainer:3d:settings:v1` | 灵敏度、FOV、准星、枪械、特效、音效和幽灵偏好 |
| `aim-trainer:3d:history:v1` | 最近最多 100 次完整单人训练 |
| `aim-trainer:3d:records:v1` | 各模式个人最佳成绩，独立于历史条数限制 |
| `aim-trainer:3d:ghost:v1` | 最佳完整三维点击训练的命中时间轴 |
| `aim-trainer:3d:panel:v1`、`aim-trainer:3d:size:v1` | 窗口位置和尺寸 |
| `aim-trainer:name:v1` | 对战昵称 |
| `aim-trainer:records:v1` | 保留的旧二维最佳成绩，在记录页单独展示 |

旧版其他偏好和幽灵数据保留在原键下。`sessionStorage` 中的 `aim-trainer:player:v1` 保存本标签页对战身份，关闭标签页即失效。浏览器存储被禁用或清除后，设置与记录可能无法保存。

单人训练在宿主加载插件后不需要联网。创建 / 加入对战房间时连接公共 broker，手动检查更新时访问 GitHub 的公开信息。

昵称、准备状态、比赛进度和成绩会经过公共 broker，使用 `fakeaim/v1/room/<房间码>/…` 公开话题。房间码并非账号或密码，拿到邀请码的人可以尝试加入，请不要把私人对战的邀请码发布到公开场合。本项目没有账号体系或服务端历史成绩库。

## 开发

生产客户端仍为单文件 `client.js`，由构建脚本内联源码。DSH 将它作为普通脚本加载，React 由宿主提供；生产运行不依赖 CDN。

```text
src/trainer.js          # DSH 注册、导航、窗口与联机界面
src/app-style.js        # 独立深色应用与响应式布局
src/scene3d.js          # 三维数学、射线命中、WebGL 房间 / 球靶 / 枪械
src/range.js            # 可测试训练状态、计时、统计与存储规则
src/range-ui.js         # Pointer Lock、渲染循环、HUD、设置、记录与结算
src/feel.js             # 旧手感辅助模块，保留兼容代码
src/ghost.js            # 幽灵时间轴验证与回放
src/updates.js          # 手动更新检查
net/mqtt.js             # MQTT 3.1.1 over WebSocket 客户端
net/room.js             # 房间状态机、版本、时钟同步与共享目标序列
net/link.js             # 公共 broker 连接层
tools/build-client.mjs  # 生成生产 client.js
tools/preview.mjs       # 本地开发预览服务器
tools/preview.html      # 最小 DSH 接口模拟页
```

构建与检查：

```bash
node tools/build-client.mjs
node tools/build-client.mjs --check
```

`--check` 检查提交的 `client.js` 是否与当前源码生成结果一致，不会改写文件。以下命令显式运行 **9 个离线测试文件**：

```bash
node --test test/client.test.mjs test/feel.test.mjs test/ghost.test.mjs test/mqtt.test.mjs test/range.test.mjs test/render.test.mjs test/room.test.mjs test/scene3d.test.mjs test/updates.test.mjs
```

真实网络测试单独运行：

```bash
node --test test/broker.test.mjs test/link.test.mjs
```

这两个文件需要访问公共 broker。`node --test test/` 会同时运行离线和网络测试；网络失败需要结合连接日志判断，不能据此认定离线训练失败。

### 本地浏览器预览

```bash
node tools/build-client.mjs
node tools/preview.mjs --port 4177
```

打开 `http://127.0.0.1:4177/?open=1` 直接展开训练应用；`http://127.0.0.1:4177/?open=1&lang=en` 使用英文。也可通过预览页顶部选择语言。

预览先从系统临时目录下的 `codex-aimlabs-preview` 读取 React 18 UMD 文件 `react.production.min.js` 和 `react-dom.production.min.js`。可用 `--vendor <目录>` 指定其他位置；文件缺失时，**仅开发预览**跳转到 jsDelivr 获取对应 React 18.3.1 文件。将文件提前放入该目录即可离线预览。生产插件始终使用 DSH 提供的 React。

预览模拟必要的 DSH 插槽和语言接口，用于检查页面和浏览器交互；它不能替代真实 Harness 宿主的兼容性验收。

## 兼容性

- 客户端平台为 `web`，依赖宿主的 `slots`、`locale`、`shell.overlay` 与 React。
- 三维训练需要 WebGL、Pointer Lock、鼠标和键盘，以及浏览器允许的硬件图形加速。触摸操作不能替代鼠标锁定。
- Pointer Lock 必须由开始 / 继续按钮等真实用户操作触发。网页嵌入策略、沙箱权限或桌面端内嵌浏览器配置可能限制它；具体 Harness 版本需在实际宿主验证，不保证所有内嵌运行环境都可用。
- WebGL 或鼠标锁定不可用时显示原因；图形上下文丢失后可重试。界面不会自动切回旧二维规则。
- 对战还需要浏览器 `WebSocket`、`crypto.randomUUID` 和可访问的公共中继。
- 当前应用版本：**2.0.0**。

## License

[MIT](./LICENSE) © 2026 cx_x
