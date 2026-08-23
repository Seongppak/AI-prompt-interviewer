import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

if (process.platform !== 'win32') process.exit(0)

const root = resolve(import.meta.dirname, '../../..')
const helperPath = resolve(root, 'dist-native/AIPIInterceptor.exe')
const targetPath = resolve(root, 'dist-native/AIPIInterceptTest.exe')

async function runScenario(mode) {
  const helper = spawn(helperPath, ['--debug'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  helper.stdout.setEncoding('utf8')
  helper.stderr.setEncoding('utf8')
  let captures = ''
  let helperErrors = ''
  helper.stdout.on('data', (chunk) => { captures += chunk })
  helper.stderr.on('data', (chunk) => { helperErrors += chunk })

  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('Interceptor ready timeout')), 3000)
    helper.stderr.on('data', (chunk) => {
      if (String(chunk).includes('ready')) { clearTimeout(timeout); resolveReady() }
    })
    helper.on('exit', (code) => reject(new Error(`Interceptor exited before ready: ${code}`)))
  })

  const target = spawn(targetPath, [mode], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
  let targetOutput = ''
  target.stdout.setEncoding('utf8')
  target.stdout.on('data', (chunk) => { targetOutput += chunk })
  const exitCode = await new Promise((resolveExit) => target.on('exit', resolveExit))
  await new Promise((resolveDrain) => setTimeout(resolveDrain, 250))
  helper.kill()

  if (exitCode !== 0 || !targetOutput.includes('blocked')) {
    throw new Error(`${mode}: target submission was not blocked (${exitCode}, ${targetOutput.trim()}; ${helperErrors.trim()})`)
  }
  const event = captures.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line))
    .find((value) => value.type === 'capture' && value.trigger === mode)
  if (!event || event.target !== 'test' || event.source !== '테스트 앱' || !/^\d+$/.test(event.window)
    || !event.prompt.includes(mode === 'click' ? '클릭' : '엔터')) {
    throw new Error(`${mode}: capture event missing (${captures.trim()}; ${helperErrors.trim()})`)
  }
}

await runScenario('enter')
await runScenario('click')
console.log('Native interceptor integration: enter PASS, click PASS')
