const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aipiDesktop', {
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    upsert: (project) => ipcRenderer.invoke('projects:upsert', project),
    remove: (id) => ipcRenderer.invoke('projects:remove', id),
  },
  platform: process.platform,
  arch: process.arch,
})
