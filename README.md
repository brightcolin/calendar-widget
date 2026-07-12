# Calendar Widget

Smart Calendar 的 Electron 桌面伴侣应用，用于显示主日历中的当日日程、管理倒计时，并提供番茄钟、每周专注统计、系统通知和空闲时全屏专注界面。

## 与 Web 应用的关系

Web 应用位于独立仓库 [`smart-calendar`](https://github.com/brightcolin/smart-calendar)。两个项目是独立应用：

- 不加载彼此源码。
- 不共享 localStorage 或本地配置。
- 分别完成 Google OAuth 登录。
- 通过同一个 Google Calendar 账号共享事件。
- Widget 只读取主日历；Web 应用可以创建和修改事件。
- 两者共同识别 `#标签 活动名`格式。

番茄钟、倒计时和专注历史只保存在 Widget 本地。

## 功能

- 显示当前时间、日期和每日提示语。
- 每 5 分钟刷新一次 Google Calendar 当日日程。
- 根据 `#标签`为事件显示颜色。
- 创建和删除本地倒计时。
- 自定义专注、短休、长休和长休周期。
- 保存当天番茄数和每周统计。
- 番茄阶段完成时显示系统通知。
- 专注运行且系统空闲一段时间后显示全屏专注界面。
- 托盘隐藏、恢复和退出。

## 环境要求

- Node.js 和 npm
- Google Cloud 项目
- 已启用的 Google Calendar API
- Google OAuth 桌面应用客户端

## 安装

```powershell
git clone https://github.com/brightcolin/calendar-widget.git
cd calendar-widget
npm install
```

复制凭据模板：

```powershell
Copy-Item credentials.example.js credentials.js
```

然后编辑 `credentials.js`：

```javascript
module.exports = {
  CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
  CLIENT_SECRET: 'your-client-secret',
};
```

`credentials.js` 已被 `.gitignore` 忽略。不要强制提交真实凭据。

## Google OAuth 配置

1. 在 Google Cloud 中启用 Google Calendar API。
2. 配置 OAuth 同意屏幕，并在测试模式下加入测试用户。
3. 创建桌面应用类型的 OAuth 客户端。
4. 将 Client ID 和 Client Secret 写入本地 `credentials.js`。
5. 启动应用并在系统浏览器完成授权。

应用使用回环地址：

```text
http://127.0.0.1:3721
```

申请的权限仅为：

```text
https://www.googleapis.com/auth/calendar.readonly
```

因此 Widget 无法创建、修改或删除 Google Calendar 事件。

## 启动

```powershell
npm start
```

首次启动会打开系统浏览器进行 Google 登录。授权成功后，Widget 会读取主日历中的当日事件。

项目目前没有打包、自动化测试或 lint 脚本。

## 数据存储

| 数据 | 存储位置 |
| --- | --- |
| Google OAuth Token | Electron `app.getPath('userData')/widget-data.json` |
| 窗口位置 | 同一个 `widget-data.json` |
| 倒计时 | Electron renderer localStorage 的 `widget_countdowns` |
| 番茄设置 | localStorage 的 `pomo_cfg` |
| 当日番茄数 | localStorage 的 `pomo_today` |
| 专注历史 | localStorage 的 `pomo_history` |
| 崩溃日志 | 用户主目录的 `calendar-widget-error.log` |

OAuth Token 当前以 JSON 形式保存在 Electron 用户数据目录中，并未额外加密。请保护操作系统账户，不要分享该数据文件；如果怀疑泄漏，应在 Google 账号安全设置中撤销应用授权。

## 安全边界

- 主窗口保持 `nodeIntegration: false` 和 `contextIsolation: true`。
- Renderer 只能通过 `preload.js` 和 `fullscreen-preload.js` 暴露的有限 IPC 调用主进程。
- 不应为了方便而开启 Renderer 的 Node.js 权限。
- `credentials.js` 不进入 Git，但桌面应用中的 OAuth Client Secret 不能被视为真正不可提取的服务器端秘密。
- 日历事件标题来自 Google Calendar，插入 HTML 前必须经过 `esc()`。

## 项目结构

```text
main.js                 Electron 主进程、OAuth、窗口、托盘和 IPC
preload.js              主 Widget 的受限 IPC 桥
renderer.js             日程、倒计时、番茄钟和界面逻辑
index.html              主 Widget 页面和样式
fullscreen-preload.js   全屏界面的受限 IPC 桥
fullscreen.html         全屏专注界面
credentials.example.js  不含真实值的 OAuth 配置模板
tray-icon.png           托盘图标
AGENTS.md               Codex 项目规范
```

## 常见问题

### 启动时提示找不到 `credentials.js`

从 `credentials.example.js` 复制一份本地 `credentials.js`，再填写 OAuth 桌面客户端信息。

### 登录后没有日程

Widget 当前只读取 `primary` 主日历。请确认事件位于同一 Google 账号的主日历，并检查 Google Calendar API 是否已启用。

### 登录页面无法完成回调

检查本机端口 `3721` 是否被占用，以及防火墙是否阻止 Node/Electron 监听本地回环地址。

### Widget 看不到 Web 应用创建的事件

确认 Web 应用使用的是同一账号的主日历。Web 应用如果选择了其他日历，Widget 当前不会显示其中的事件。

## 开发验证

修改后至少验证：

1. `node --check` 能通过所有 JavaScript 文件。
2. `npm start` 可以打开 Widget。
3. 登录、Token 刷新、退出和五分钟刷新正常。
4. 番茄钟开始、暂停、重置、跳过、通知和全屏模式正常。
5. 托盘隐藏、恢复和退出正常。
6. 修改标签解析时同步检查 `smart-calendar/calendar.js`。

## License

[MIT License](LICENSE)

---

## English

Calendar Widget is the Electron desktop companion to Smart Calendar. It displays read-only events from the primary Google Calendar, provides local countdowns, and includes a Pomodoro timer with notifications, weekly statistics, tray controls, and an idle-triggered fullscreen focus view.

Install dependencies with `npm install`, copy `credentials.example.js` to `credentials.js`, configure a Google OAuth desktop client, and run `npm start`.

Licensed under the [MIT License](LICENSE).
