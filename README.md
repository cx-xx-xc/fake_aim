# Aim Trainer for DeepSeek Harness

一个跑在 DeepSeek Harness Web UI 里的瞄准训练小工具：可拖动的浮动窗口，Aimlabs 风格深色界面，三种训练模式，成绩存在本地。

A floating aim-training window for the DeepSeek Harness Web UI. Draggable, Aimlabs-inspired dark panel, three drills, all records kept locally.

## 功能 / Features

| 模式 | 玩法 | 时长 |
| --- | --- | --- |
| 点击 / Click | 靶子随机刷新，尽可能快地点掉 | 30 秒 |
| 反应 / Reaction | 靶子延迟出现，测平均反应时间 | 8 轮 |
| 跟枪 / Tracking | 靶子持续漂移，光标停在靶内累计时间 | 20 秒 |

- 每次开始前有 **2 秒倒计时**（2 → 1）。
- 窗口可拖动：按住标题栏拖到任意位置，位置本地记住；标题栏 `⌖` 一键回屏幕中间。
- 成绩（最高分、平均反应、命中率）保存在浏览器 `localStorage`，不上传任何数据。

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

## 数据与隐私 / Data

仅使用浏览器 `localStorage`：

- `aim-trainer:records:v1` — 各模式最佳成绩。
- `aim-trainer:panel:v1` — 窗口位置。

没有网络请求、没有遥测。

## 开发 / Development

```bash
node --check client.js   # 语法检查
```

文件结构：

```
package.json        # bundle 元数据（dsh.bundle / dsh.client 段）
cordis.patch.yml    # 向 Harness 组合插入本插件
index.js            # Host 侧入口（本插件为空实现）
client.js           # 全部界面与玩法逻辑
locale/en.json      # 文案（英文）
locale/zh.json      # 文案（中文）
icon.svg            # 插件图标
```

## 兼容性 / Compatibility

- 客户端平台：`web`（Harness Web UI / 桌面端内嵌 Web UI）。
- 依赖宿主提供的 `slots` 与 `locale` 服务，以及 `shell.overlay` 插槽。
- 版本：`1.1.0`。

## License

[MIT](./LICENSE) © 2026 cx_x
