import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import electronPath from 'electron'

const repoRoot = resolve(import.meta.dirname, '../..')
const viteBin = resolve(repoRoot, 'node_modules/vite/bin/vite.js')
const devUrl = 'http://127.0.0.1:5176'
const vite = spawn(process.execPath, [viteBin, '--config', 'vite.desktop.config.ts', '--host', '127.0.0.1', '--port', '5176'], {
  cwd: repoRoot,
  stdio: 'inherit',
})

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(devUrl)
      if (response.ok) return
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  throw new Error('Desktop Vite 서버가 준비되지 않았습니다.')
}

try {
  await waitForServer()
  const desktop = spawn(electronPath, ['apps/desktop/electron/main.cjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, AIPI_DESKTOP_DEV_URL: devUrl },
  })
  desktop.on('exit', (code) => {
    vite.kill()
    process.exitCode = code ?? 0
  })
} catch (error) {
  vite.kill()
  throw error
}
