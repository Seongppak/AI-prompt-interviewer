const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aipiDesktop', {
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  openGeminiApiKeyPage: () => ipcRenderer.invoke('external:gemini-api-key'),
  captureShortcut: () => ipcRenderer.invoke('shortcut:capture:get'),
  onClipboardCapture: (listener) => {
    const handler = () => listener()
    ipcRenderer.on('capture:clipboard', handler)
    return () => ipcRenderer.removeListener('capture:clipboard', handler)
  },
  interceptor: {
    status: () => ipcRenderer.invoke('interceptor:status:get'),
    setEnabled: (enabled) => ipcRenderer.invoke('interceptor:set-enabled', enabled),
    insertPrompt: (text) => ipcRenderer.invoke('interceptor:insert-result', text),
    onCapture: (listener) => {
      const handler = (_event, capture) => listener(capture)
      ipcRenderer.on('interceptor:capture', handler)
      return () => ipcRenderer.removeListener('interceptor:capture', handler)
    },
    onStatus: (listener) => {
      const handler = (_event, status) => listener(status)
      ipcRenderer.on('interceptor:status', handler)
      return () => ipcRenderer.removeListener('interceptor:status', handler)
    },
  },
  geminiApiKey: {
    load: () => ipcRenderer.invoke('secret:gemini:get'),
    save: (apiKey) => ipcRenderer.invoke('secret:gemini:set', apiKey),
    clear: () => ipcRenderer.invoke('secret:gemini:clear'),
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    upsert: (project) => ipcRenderer.invoke('projects:upsert', project),
    remove: (id) => ipcRenderer.invoke('projects:remove', id),
  },
  platform: process.platform,
  arch: process.arch,
})
