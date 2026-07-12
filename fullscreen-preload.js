const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fs_widget', {
  onInit:       (cb) => ipcRenderer.on('pomo:init',        (_, state)  => cb(state)),
  onTick:       (cb) => ipcRenderer.on('pomo:tick',        (_, r, m)   => cb(r, m)),
  onClose:      (cb) => ipcRenderer.on('fullscreen:close', ()          => cb()),
  onPauseState: (cb) => ipcRenderer.on('pomo:pause-state', (_, paused) => cb(paused)),
  close:        ()   => ipcRenderer.send('fullscreen:close'),
  togglePause:  ()   => ipcRenderer.send('pomo:pause-toggle'),
});
