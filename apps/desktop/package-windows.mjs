import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const cache = resolve(root, '.electron-builder-cache')
const cli = resolve(root, 'node_modules/electron-builder/cli.js')
mkdirSync(cache, { recursive: true })

const result = spawnSync(process.execPath, [
  cli,
  '--config', 'electron-builder.config.cjs',
  '--win', 'nsis',
  '--x64',
], {
  cwd: root,
  env: { ...process.env, ELECTRON_BUILDER_CACHE: cache },
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
