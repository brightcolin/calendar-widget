const { app, BrowserWindow, ipcMain, screen, shell, net, Notification, powerMonitor, Tray, Menu, nativeImage } = require('electron');
const path   = require('path');
const http   = require('http');
const crypto = require('crypto');
const fs     = require('fs');
const os     = require('os');
const { URL } = require('url');

// Write crash info to home dir so startup failures are diagnosable
const logFile = path.join(os.homedir(), 'calendar-widget-error.log');
process.on('uncaughtException', (err) => {
  fs.appendFileSync(logFile, `${new Date().toISOString()}\n${err.stack}\n\n`);
});

const { CLIENT_ID, CLIENT_SECRET } = require('./credentials.js');

const SCOPES        = 'https://www.googleapis.com/auth/calendar.readonly';
const REDIRECT_PORT = 3721;

// ── Simple fs-based storage ─────────────────────────────────────

const dataFile = path.join(app.getPath('userData'), 'widget-data.json');

function storeGet(key) {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8'))[key]; }
  catch { return undefined; }
}

function storeSet(key, value) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch {}
  data[key] = value;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data), 'utf8');
}

function storeDelete(key) {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    delete data[key];
    fs.writeFileSync(dataFile, JSON.stringify(data), 'utf8');
  } catch {}
}

// ── OAuth helpers ───────────────────────────────────────────────

function buildAuthURL() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  `http://127.0.0.1:${REDIRECT_PORT}`,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code) {
  const resp = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  `http://127.0.0.1:${REDIRECT_PORT}`,
      grant_type:    'authorization_code',
    }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

async function doRefresh(refreshTok) {
  const resp = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshTok,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

// ── IPC handlers ────────────────────────────────────────────────

ipcMain.handle('auth:login', () => new Promise((resolve, reject) => {
  let settled = false;

  const server = http.createServer(async (req, res) => {
    if (settled) { res.end(); return; }
    settled = true;

    const url = new URL(req.url, `http://127.0.0.1:${REDIRECT_PORT}`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><body style="background:#0a0c14;color:#fff;font-family:sans-serif;
      display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
      <div style="font-size:48px">✅</div>
      <p style="font-size:18px">授权成功，请关闭此标签页</p>
    </body></html>`);
    server.close();

    const code = url.searchParams.get('code');
    if (!code) { reject(new Error('Authorization cancelled')); return; }

    try {
      const tokens = await exchangeCode(code);
      storeSet('tokens', {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    Date.now() + tokens.expires_in * 1000,
      });
      resolve(tokens.access_token);
    } catch (e) { reject(e); }
  });

  const timer = setTimeout(() => {
    if (!settled) { settled = true; server.close(); reject(new Error('Login timeout')); }
  }, 3 * 60 * 1000);
  server.on('close', () => clearTimeout(timer));

  server.listen(REDIRECT_PORT, '127.0.0.1', () => shell.openExternal(buildAuthURL()));
}));

ipcMain.handle('auth:getToken', async () => {
  const tokens = storeGet('tokens');
  if (!tokens) return null;

  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token;

  if (!tokens.refresh_token) { storeDelete('tokens'); return null; }
  try {
    const fresh = await doRefresh(tokens.refresh_token);
    storeSet('tokens', {
      access_token:  fresh.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    Date.now() + fresh.expires_in * 1000,
    });
    return fresh.access_token;
  } catch {
    storeDelete('tokens');
    return null;
  }
});

ipcMain.handle('auth:logout', () => storeDelete('tokens'));

ipcMain.on('notify', (_, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

ipcMain.handle('system:idleTime', () => powerMonitor.getSystemIdleTime());

// ── Fullscreen screensaver window ────────────────────────────────

let fullscreenWin = null;

function createFullscreenWindow(state) {
  if (fullscreenWin) return;
  const { bounds } = screen.getPrimaryDisplay();
  fullscreenWin = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame:       false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable:   true,
    backgroundColor: '#0a0604',
    webPreferences: {
      preload:          path.join(__dirname, 'fullscreen-preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });
  fullscreenWin.loadFile(path.join(__dirname, 'fullscreen.html'));
  fullscreenWin.webContents.once('did-finish-load', () => {
    fullscreenWin?.webContents.send('pomo:init', state);
  });
  fullscreenWin.on('closed', () => {
    fullscreenWin = null;
    mainWindow?.webContents.send('fullscreen:did-close');
  });
}

ipcMain.on('fullscreen:open',  (_, state)          => createFullscreenWindow(state));
ipcMain.on('fullscreen:close', ()                  => { fullscreenWin?.close(); });
ipcMain.on('pomo:tick',        (_, remaining, mode) => {
  fullscreenWin?.webContents.send('pomo:tick', remaining, mode);
});
ipcMain.on('pomo:pause-toggle', () => {
  mainWindow?.webContents.send('pomo:pause-toggle');
});
ipcMain.on('pomo:pause-state', (_, paused) => {
  fullscreenWin?.webContents.send('pomo:pause-state', paused);
});

// ── Tray ────────────────────────────────────────────────────────

let tray = null;

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Calendar Widget');

  const updateMenu = () => {
    const isVisible = mainWindow?.isVisible();
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: isVisible ? '隐藏 Widget' : '显示 Widget',
        click: () => {
          if (mainWindow?.isVisible()) mainWindow.hide();
          else { mainWindow?.show(); mainWindow?.focus(); }
          updateMenu();
        },
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]));
  };

  updateMenu();
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else { mainWindow?.show(); mainWindow?.focus(); }
    updateMenu();
  });
}

// ── Window ──────────────────────────────────────────────────────

let mainWindow;

function createWidget() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const savedPos = storeGet('winPos');
  const x = savedPos?.x ?? width  - 316;
  const y = savedPos?.y ?? height - 656;

  mainWindow = new BrowserWindow({
    width:  300,
    height: 640,
    x, y,
    transparent:   true,
    frame:         false,
    alwaysOnTop:   false,
    skipTaskbar:   true,
    focusable:     true,
    resizable:     false,
    hasShadow:     false,
    webPreferences: {
      preload:              path.join(__dirname, 'preload.js'),
      nodeIntegration:      false,
      contextIsolation:     true,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('moved', () => {
    const [wx, wy] = mainWindow.getPosition();
    storeSet('winPos', { x: wx, y: wy });
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
}

app.whenReady().then(() => {
  // In dev mode, must pass the app path as arg so Windows knows what to launch
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()],
  });
  createWidget();
  createTray();
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
