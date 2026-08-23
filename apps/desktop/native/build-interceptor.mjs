import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

if (process.platform !== 'win32') process.exit(0)

const root = resolve(import.meta.dirname, '../../..')
const outputDirectory = resolve(root, 'dist-native')
mkdirSync(outputDirectory, { recursive: true })

const framework = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319'
const gac = 'C:\\Windows\\assembly\\GAC_MSIL'
const references = [
  `${framework}\\System.Windows.Forms.dll`,
  `${gac}\\UIAutomationClient\\3.0.0.0__31bf3856ad364e35\\UIAutomationClient.dll`,
  `${gac}\\UIAutomationTypes\\3.0.0.0__31bf3856ad364e35\\UIAutomationTypes.dll`,
  `${gac}\\WindowsBase\\3.0.0.0__31bf3856ad364e35\\WindowsBase.dll`,
]

const interceptorPath = resolve(outputDirectory, 'AIPIInterceptor.exe')

execFileSync(`${framework}\\csc.exe`, [
  '/nologo', '/target:exe', '/platform:x64', '/optimize+',
  `/out:${interceptorPath}`,
  ...references.map((reference) => `/reference:${reference}`),
  resolve(import.meta.dirname, 'PromptInterceptor.cs'),
], { cwd: root, stdio: 'inherit' })

const utf8Output = execFileSync(interceptorPath, ['--self-test-utf8'], { cwd: root, encoding: 'utf8' }).trim()
if (utf8Output !== '{"text":"한글 프롬프트"}') {
  throw new Error(`Native UTF-8 self-test failed: ${JSON.stringify(utf8Output)}`)
}

execFileSync(`${framework}\\csc.exe`, [
  '/nologo', '/target:winexe', '/platform:x64', '/optimize+',
  `/out:${resolve(outputDirectory, 'AIPIInterceptTest.exe')}`,
  `/reference:${framework}\\System.Windows.Forms.dll`,
  `/reference:${framework}\\System.Drawing.dll`,
  resolve(import.meta.dirname, 'AIPIInterceptTest.cs'),
], { cwd: root, stdio: 'inherit' })
