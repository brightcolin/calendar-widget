# AGENTS.md

## Project overview

This directory contains the Electron desktop companion for Smart Calendar. It
shows today's Google Calendar events, user-defined countdowns, and a Pomodoro
timer in a small desktop widget. It is independent from the sibling
`../smart-calendar` web application.

Keep JavaScript, HTML, JSON, and documentation encoded as UTF-8. Preserve the
existing Chinese UI copy unless a task explicitly requests wording changes.

## Setup and run

Install dependencies from this directory:

```powershell
npm install
```

Copy `credentials.example.js` to `credentials.js`, then fill in the local OAuth
desktop-client values. Never commit the populated file.

Start the widget with:

```powershell
npm start
```

There is currently no build, package, automated test, or lint script.

## Architecture

| File | Responsibility |
| --- | --- |
| `main.js` | Electron main process, OAuth callback server, token refresh, windows, tray, notifications, and IPC |
| `preload.js` | Narrow bridge exposed to the main widget renderer as `window.widget` |
| `renderer.js` | Main widget UI, Calendar fetch/rendering, countdowns, Pomodoro state, and timers |
| `index.html` | Widget markup and styling |
| `fullscreen-preload.js` | Narrow bridge exposed to the fullscreen renderer as `window.fs_widget` |
| `fullscreen.html` | Fullscreen Pomodoro display and controls |
| `credentials.js` | Local OAuth client values; ignored and never committed |

The main window uses `nodeIntegration: false` and `contextIsolation: true`.
Preserve that boundary. Renderer code must use the preload bridges rather than
enabling Node.js access or importing Electron directly.

## Authentication and storage

- Google OAuth is implemented in `main.js` with a loopback redirect on port
  `3721`.
- The requested scope is
  `https://www.googleapis.com/auth/calendar.readonly`. Do not broaden it
  without an explicit feature and security review.
- Refresh and access tokens are stored in Electron's user-data directory via
  `widget-data.json`, not in repository files.
- Window position is stored through the same main-process data file.
- Renderer localStorage keys include `widget_countdowns`, `pomo_cfg`,
  `pomo_today`, and `pomo_history`.
- The error log is written to `calendar-widget-error.log` in the user's home
  directory.

Never print, copy, commit, or include real credential/token values in patches,
tests, documentation, or diagnostic output.

## Companion web app contract

The sibling `../smart-calendar` project does not supply code or local data to
this widget. The applications communicate only through Google Calendar.

`renderer.js` recognizes the `#标签 活动名` event-title prefix and maps these
tags to colors: `学习`, `课程`, `科研`, `社工`, `运动`, `娱乐`, `工作`, and
`其他`. When changing this parser, tag vocabulary, or Calendar query behavior,
inspect `../smart-calendar/calendar.js` and its project-level `AGENTS.md`.

The widget reads the primary calendar only. Do not assume it will display an
event created by the web app when the web app is configured to use a different
calendar.

The widget owns the active Pomodoro implementation. Its localStorage values are
not shared with the web app. The web repository's dormant Pomodoro hook is not
a runtime dependency.

## Editing expectations

- Keep main-process, preload, and renderer responsibilities separated.
- Add new privileged operations through a minimal, named preload/IPC method;
  validate inputs in the main process.
- Avoid inline event handlers; existing renderer listeners are intentionally
  attached from JavaScript for Electron sandbox compatibility.
- Escape user-controlled or Calendar-provided text with `esc()` before placing
  it in `innerHTML`.
- Clean up intervals and IPC listeners when adding lifecycle-sensitive UI.
- Keep `package-lock.json` tracked when dependencies change.
- Do not edit generated `node_modules/` content.

## Verification

After a change:

1. Run `npm start` and check both terminal output and
   `%USERPROFILE%\calendar-widget-error.log` for errors.
2. Confirm the widget opens, hides/restores through the tray, and retains its
   saved position when relevant.
3. For Calendar changes, test login, token refresh behavior, five-minute
   refresh, event ordering, and logout without exposing token values.
4. For Pomodoro changes, test start, pause, reset, skip, completion,
   notification, idle-triggered fullscreen mode, and settings/history storage.
5. For IPC or fullscreen changes, test both the main widget and fullscreen
   window and confirm context isolation remains enabled.
6. For tag/title changes, verify compatibility with `../smart-calendar`.
