# Aim Trainer for DeepSeek Harness

一个跑在 DeepSeek Harness Web UI 里的瞄准训练小工具：可拖动的浮动窗口，Aimlabs 风格深色界面，三种单人训练模式，外加房间码 1v1 对战，成绩存在本地。

A floating aim-training window for the DeepSeek Harness Web UI. Draggable, Aimlabs-inspired dark panel, three solo drills, room-code 1v1 duels, records kept locally.

## 功能 / Features

| 模式 | 玩法 | 时长 |
| --- | --- | --- |
| 点击 / Click | 靶子随机刷新，尽可能快地点掉 | 30 秒 |
| 反应 / Reaction | 靶子延迟出现，测平均反应时间 | 8 轮 |
| 跟枪 / Tracking | 靶子持续漂移，光标停在靶内累计时间 | 20 秒 |

- 每次开始前有 **2 秒倒计时**（2 → 1）。
- 窗口可拖动：按住标题栏拖到任意位置，位置本地记住；标题栏 `⌖` 一键回屏幕中间。
- 对战：输入 6 位房间码即可和朋友比「点击」或「反应」，双方拿到同一套靶子序列和同一个开局时间，结束后两边各自看到比分。
- 成绩（最高分、平均反应、命中率）保存在浏览器 `localStorage`，不上传任何成绩以外的东西。

## 安装 / Install

要求：可用的 DeepSeek Harness 桌面端或 Web 端。

### 方式一：从 GitHub 直接安装

在 Harness 的 **设置 → 插件 → 安装** 中填入本仓库地址：

```
github:cx-xx-xc/fake_aim
```

或完整地址：

```
https://github.com/cx-xx-xc/fake_aim
```

> 该插件是 Cordis bundle，安装后会自动注册到 `shell.overlay` 插槽，无需改配置文件。

### 方式二：克隆到工作区后用本地链接安装

```bash
git clone https://github.com/cx-xx-xc/fake_aim.git
```

然后在 Harness 插件管理器里把安装目标设为该目录的 `link:` 形式：

```
link:<克隆到的绝对路径>
```

本地链接安装的好处：改 `client.js` 后刷新页面即可生效，不需要重新安装。

## 使用 / Usage

1. 右上角出现 `🎯` 启动按钮，点开训练面板。
2. 选择模式 → 点「开始」→ 等 2 秒倒计时结束。
3. 拖动标题栏可以把窗口放到屏幕中间或任何位置。

## 联机对战 / Duels

对战走公共 MQTT broker（`broker.emqx.io`，备用 `broker.hivemq.com`），没有自建服务器、不用注册账号。

1. 打开面板的「对战 / Versus」页，填一个昵称。
2. 一个人点「创建房间」，把生成的 6 位房间码（例如 `7K3Q9F`）发给朋友。
3. 朋友在同一个页面填房间码点「加入」，双方点「准备」。
4. 房主选「点击」或「反应」并开始，两边同时进入倒计时并开始同一局。
5. 打完各自上报成绩，两边都看到同一个比分板，可以直接「再来一局」。

注意：

- 房间码只是一串随机字符，谁拿到谁都能进，请不要发到公开场合。
- 分数、昵称、准备状态会经过公共 broker，属于公开话题（`fakeaim/v1/room/<房间码>/…`）；没有账号、没有历史记录。
- 公共 broker 没有可用性承诺，连不上时面板会提示重试。
- 跨公网延迟通常在 30–150ms，双方靠时钟同步对齐开局时间。

## 数据与隐私 / Data

本地 `localStorage`：

- `aim-trainer:records:v1` — 各模式最佳成绩。
- `aim-trainer:panel:v1` — 窗口位置。
- `aim-trainer:name:v1` — 对战昵称。
- 会话级 `sessionStorage` `aim-trainer:player:v1` — 本标签页的对战身份（关掉标签页即失效）。

单人训练完全不联网；只有进入「对战」页并创建/加入房间时才会连接公共 broker。

## 开发 / Development

源码是分层的，`client.js` 由构建脚本拼成单文件（Harness 的客户端 bundle 是普通脚本，不能 `import` 同级文件）：

```
src/trainer.js      # 界面与玩法（React 组件，源码）
net/mqtt.js         # 零依赖 MQTT 3.1.1 over WebSocket 客户端
net/room.js         # 房间状态机、房间码、时钟同步、靶子序列
net/link.js         # 把 room 接到真实 broker 上的连接层
tools/build-client.mjs  # 把上面四份拼成 client.js
```

```bash
node tools/build-client.mjs          # 重新生成 client.js
node tools/build-client.mjs --check  # 只做语法检查
node --test test/                    # 单元测试 + 真实 broker 端到端测试
```

测试会连真实的公共 broker（`test/broker.test.mjs`、`test/link.test.mjs`），没网时会失败，属于预期。

## 兼容性 / Compatibility

- 客户端平台：`web`（Harness Web UI / 桌面端内嵌 Web UI）。
- 依赖宿主提供的 `slots` 与 `locale` 服务，以及 `shell.overlay` 插槽。
- 对战额外依赖浏览器原生 `WebSocket` 与 `crypto.randomUUID`。
- 版本：`1.2.0`。

## License

[MIT](./LICENSE) © 2026 cx_x
