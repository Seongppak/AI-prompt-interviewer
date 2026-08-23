const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, safeStorage, shell } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { registerProjectStore } = require('./project-store.cjs')
const { registerSecretStore } = require('./secret-store.cjs')

let mainWindow = null
let captureShortcut = ''
let interceptorProcess = null
let interceptorError = ''
let lastInterceptedWindow = ''

function interceptorExecutablePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'AIPIInterceptor.exe')
    : path.resolve(__dirname, '../../../dist-native/AIPIInterceptor.exe')
}

function interceptorStatus() {
  return {
    enabled: interceptorProcess !== null,
    available: process.platform === 'win32',
    error: interceptorError,
  }
}

function sendInterceptorStatus() {
  mainWindow?.webContents.send('interceptor:status', interceptorStatus())
}

function handleInterceptorLine(line) {
  try {
    const event = JSON.parse(line)
    if (event?.type !== 'capture' || typeof event.prompt !== 'string') return
    if (!['chatgpt', 'claude', 'claude-code', 'codex', 'test'].includes(event.target)) return
    if (typeof event.source !== 'string' || !event.source.trim() || event.source.length > 80
      || event.source.includes('\r') || event.source.includes('\n') || event.source.includes('\0')) return
    if (typeof event.window !== 'string' || !/^\d{1,20}$/.test(event.window)) return
    if (!['enter', 'click'].includes(event.trigger) || !event.prompt.trim() || event.prompt.length > 100000) return
    lastInterceptedWindow = event.window
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('interceptor:capture', {
      prompt: event.prompt.trim(),
      target: event.target,
      source: event.source.trim(),
      trigger: event.trigger,
    })
  } catch {}
}

function insertIntoLastInterceptedWindow(text) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'Windows에서만 사용할 수 있습니다.' })
  if (!lastInterceptedWindow) return Promise.resolve({ ok: false, error: '돌아갈 채팅창 정보가 없습니다.' })
  const prompt = String(text ?? '')
  if (!prompt.trim() || prompt.length > 100000) return Promise.resolve({ ok: false, error: '입력할 프롬프트가 없습니다.' })
  clipboard.writeText(prompt)
  const executable = interceptorExecutablePath()
  return new Promise((resolveInsert) => {
    const child = spawn(executable, [`--paste-window=${lastInterceptedWindow}`], {
      windowsHide: true,
      stdio: 'ignore',
    })
    child.on('error', (error) => resolveInsert({ ok: false, error: String(error) }))
    child.on('exit', (code) => resolveInsert(code === 0
      ? { ok: true, error: '' }
      : { ok: false, error: '원래 채팅창을 활성화하지 못했습니다. 창이 닫혔는지 확인하세요.' }))
  })
}

function startInterceptor() {
  if (interceptorProcess) return interceptorStatus()
  if (process.platform !== 'win32') {
    interceptorError = 'Windows에서만 사용할 수 있습니다.'
    return interceptorStatus()
  }
  const executable = interceptorExecutablePath()
  let stdoutBuffer = ''
  interceptorError = ''
  const child = spawn(executable, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  interceptorProcess = child
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk
    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() ?? ''
    for (const line of lines) handleInterceptorLine(line)
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    const message = String(chunk).trim()
    if (message && message !== 'ready') console.warn(`[interceptor] ${message}`)
  })
  child.on('error', (error) => {
    interceptorError = String(error)
    interceptorProcess = null
    sendInterceptorStatus()
  })
  child.on('exit', (code) => {
    if (interceptorProcess === child) interceptorProcess = null
    if (code && !interceptorError) interceptorError = `가로채기 Helper가 종료됐습니다. (${code})`
    sendInterceptorStatus()
  })
  return interceptorStatus()
}

function stopInterceptor() {
  const child = interceptorProcess
  interceptorProcess = null
  if (child && !child.killed) child.kill()
  interceptorError = ''
  return interceptorStatus()
}

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
  mainWindow = window
  window.on('closed', () => { if (mainWindow === window) mainWindow = null })
}

function registerCaptureShortcut() {
  const candidates = [
    { accelerator: 'CommandOrControl+Shift+Space', label: 'Ctrl+Shift+Space' },
    { accelerator: 'CommandOrControl+Alt+Space', label: 'Ctrl+Alt+Space' },
  ]
  for (const candidate of candidates) {
    const registered = globalShortcut.register(candidate.accelerator, () => {
      if (!mainWindow) createWindow()
      if (mainWindow?.isMinimized()) mainWindow.restore()
      mainWindow?.show()
      mainWindow?.focus()
      mainWindow?.webContents.send('capture:clipboard')
    })
    if (registered) {
      captureShortcut = candidate.label
      console.info(`[desktop] capture shortcut registered: ${captureShortcut}`)
      return
    }
  }
  console.warn('[desktop] capture shortcut registration failed')
}

ipcMain.handle('clipboard:read', () => clipboard.readText())
ipcMain.handle('clipboard:write', (_event, text) => {
  clipboard.writeText(String(text))
})
ipcMain.handle('external:gemini-api-key', () => {
  return shell.openExternal('https://aistudio.google.com/apikey')
})
ipcMain.handle('shortcut:capture:get', () => captureShortcut)
ipcMain.handle('interceptor:status:get', () => interceptorStatus())
ipcMain.handle('interceptor:set-enabled', (_event, enabled) => enabled ? startInterceptor() : stopInterceptor())
ipcMain.handle('interceptor:insert-result', (_event, text) => insertIntoLastInterceptedWindow(text))
registerProjectStore(ipcMain, app)
registerSecretStore(ipcMain, app, safeStorage)

app.whenReady().then(() => {
  createWindow()
  registerCaptureShortcut()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  stopInterceptor()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
