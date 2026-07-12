const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  login:    ()            => ipcRenderer.invoke('auth:login'),
  getToken: ()            => ipcRenderer.invoke('auth:getToken'),
  logout:   ()            => ipcRenderer.invoke('auth:logout'),
  notify:   (title, body) => ipcRenderer.send('notify', title, body),

  getIdleTime:        ()       => ipcRenderer.invoke('system:idleTime'),
  openFullscreen:     (state)  => ipcRenderer.send('fullscreen:open', state),
  closeFullscreen:    ()       => ipcRenderer.send('fullscreen:close'),
  sendTick:           (r, m)   => ipcRenderer.send('pomo:tick', r, m),
  onFullscreenClosed: (cb)     => ipcRenderer.on('fullscreen:did-close', cb),
  onPauseToggle:      (cb)     => ipcRenderer.on('pomo:pause-toggle', cb),
  sendPauseState:     (paused) => ipcRenderer.send('pomo:pause-state', paused),
});
