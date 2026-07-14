# Calendar Widget

[English](README.md) | [简体中文](README.zh-CN.md)

The Electron desktop companion to Smart Calendar. It displays today's events from the primary Google Calendar, manages local countdowns, and provides a Pomodoro timer with weekly focus statistics, system notifications, and an idle-triggered fullscreen focus view.

## Relationship to the Web App

The web application is maintained in the separate [`smart-calendar`](https://github.com/brightcolin/smart-calendar) repository. The two projects are independent applications:

- They do not load each other's source code.
- They do not share localStorage or local configuration.
- They complete Google OAuth authorization independently.
- They share events through the same Google Calendar account.
- The Widget reads only the primary calendar; the web app can create and update events.
- Both recognize the `#tag event name` convention.

Pomodoro settings, countdowns, and focus history are stored only by the Widget.

## Features

- Display the current time, date, and a daily message.
- Refresh today's Google Calendar events every five minutes.
- Color events according to their `#tag` prefix.
- Create and delete local countdowns.
- Customize focus, short-break, and long-break durations and the long-break interval.
- Save today's Pomodoro count and weekly statistics.
- Show system notifications when a Pomodoro phase finishes.
- Open a fullscreen focus view when focus is running and the system has been idle for a configured period.
- Hide, restore, and exit from the system tray.

## Requirements

- Node.js and npm
- A Google Cloud project
- Google Calendar API enabled
- A Google OAuth client of the **Desktop app** type

## Installation

```powershell
git clone https://github.com/brightcolin/calendar-widget.git
cd calendar-widget
npm install
```

Copy the credential template:

```powershell
Copy-Item credentials.example.js credentials.js
```

Then edit `credentials.js`:

```javascript
module.exports = {
  CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
  CLIENT_SECRET: 'your-client-secret',
};
```

`credentials.js` is ignored by `.gitignore`. Never force-add real credentials to Git.

## Google OAuth Setup

1. Enable the Google Calendar API in Google Cloud.
2. Configure the OAuth consent screen and add test users while the app is in testing mode.
3. Create an OAuth client of the **Desktop app** type.
4. Add its Client ID and Client Secret to the local `credentials.js` file.
5. Start the application and complete authorization in the system browser.

The application uses this loopback redirect:

```text
http://127.0.0.1:3721
```

It requests only this scope:

```text
https://www.googleapis.com/auth/calendar.readonly
```

The Widget therefore cannot create, update, or delete Google Calendar events.

## Running

```powershell
npm start
```

The first run opens the system browser for Google sign-in. After authorization, the Widget reads today's events from the primary calendar.

The project currently has no packaging, automated test, or lint script.

## Data Storage

| Data | Storage location |
| --- | --- |
| Google OAuth tokens | Electron `app.getPath('userData')/widget-data.json` |
| Window position | The same `widget-data.json` file |
| Countdowns | Electron renderer localStorage key `widget_countdowns` |
| Pomodoro settings | localStorage key `pomo_cfg` |
| Today's Pomodoro count | localStorage key `pomo_today` |
| Focus history | localStorage key `pomo_history` |
| Error log | `calendar-widget-error.log` in the user's home directory |

OAuth tokens are currently stored as JSON in Electron's user-data directory without additional encryption. Protect the operating-system account and do not share this file. If exposure is suspected, revoke the application's access from the Google Account security settings.

## Security Boundaries

- The main window keeps `nodeIntegration: false` and `contextIsolation: true`.
- Renderer processes can reach the main process only through the limited IPC methods exposed by `preload.js` and `fullscreen-preload.js`.
- Do not enable Node.js access in a renderer for convenience.
- `credentials.js` is excluded from Git, but an OAuth Client Secret embedded in a desktop application cannot be treated as a true server-side secret.
- Google Calendar event titles are untrusted input and must pass through `esc()` before being inserted into HTML.

## Project Structure

```text
main.js                 Electron main process, OAuth, windows, tray, and IPC
preload.js              Restricted IPC bridge for the main Widget
renderer.js             Calendar events, countdowns, Pomodoro timer, and UI
index.html              Main Widget page and styles
fullscreen-preload.js   Restricted IPC bridge for the fullscreen view
fullscreen.html         Fullscreen focus interface
credentials.example.js  OAuth configuration template without real values
tray-icon.png           System tray icon
AGENTS.md               Codex project instructions
```

## Troubleshooting

### `credentials.js` cannot be found at startup

Copy `credentials.example.js` to a local `credentials.js` file, then enter the OAuth desktop-client values.

### No events appear after sign-in

The Widget currently reads only the `primary` calendar. Confirm that the event belongs to the same Google account's primary calendar and that the Google Calendar API is enabled.

### The sign-in page cannot complete the callback

Check whether another process is using port `3721` and whether the firewall prevents Node/Electron from listening on the local loopback interface.

### Events created by the web app do not appear

Confirm that the web app uses the same account and its primary calendar. Events written to another calendar are not currently displayed by the Widget.

## Development Verification

After making changes, at minimum:

1. Run `node --check` on all JavaScript files.
2. Confirm that `npm start` opens the Widget.
3. Test sign-in, token refresh, sign-out, and the five-minute refresh.
4. Test Pomodoro start, pause, reset, skip, notifications, and fullscreen mode.
5. Test tray hide, restore, and exit actions.
6. If tag parsing changes, also inspect `smart-calendar/calendar.js`.

## License

[MIT License](LICENSE)
