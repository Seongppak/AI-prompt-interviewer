const { app, BrowserWindow, clipboard, ipcMain } = require('electron')
const path = require('node:path')
const { registerProjectStore } = require('./project-store.cjs')

function createWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    title: 'AI Prompt Interviewer',
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const devUrl = process.env.AIPI_DESKTOP_DEV_URL
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(path.resolve(__dirname, '../../../dist-desktop/index.html'))
}

ipcMain.handle('clipboard:read', () => clipboard.readText())
ipcMain.handle('clipboard:write', (_event, text) => {
  clipboard.writeText(String(text))
})
registerProjectStore(ipcMain, app)

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
