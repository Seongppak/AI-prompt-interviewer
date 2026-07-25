// 프롬프트를 #aipi= 해시로 감싸 대상 AI 사이트를 브라우저에서 연다.
// content script가 해시를 읽어 입력창에 넣어주므로 사이트의 프리필 지원이 필요 없다.
//
// 사용법:
//   node scripts/send-to-browser.mjs chatgpt "프롬프트 내용"
//   node scripts/send-to-browser.mjs claude < prompt.txt
//   node scripts/send-to-browser.mjs --url  chatgpt "프롬프트"   (열지 않고 URL만 출력)
import { spawn } from 'node:child_process'

// TODO: src/shared/sites.ts와 중복 — 스킬 단계에서 단일 원본으로 합칠 것.
const SITES = {
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
  grok: 'https://grok.com/',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai/',
  copilot: 'https://copilot.microsoft.com/',
}

function encodePromptHash(prompt) {
  return `#aipi=${Buffer.from(prompt, 'utf8').toString('base64url')}`
}

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
  })
}

function openUrl(url) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

const argv = process.argv.slice(2)
const urlOnly = argv[0] === '--url'
const [site, ...rest] = urlOnly ? argv.slice(1) : argv

const base = SITES[site]
if (!base) {
  console.error(`알 수 없는 사이트: ${site ?? '(없음)'}`)
  console.error(`사용 가능: ${Object.keys(SITES).join(', ')}`)
  process.exit(1)
}

// 인자로 안 주면 stdin에서 읽는다 — 긴 프롬프트는 셸 인자 길이 제한에 걸린다.
const prompt = (rest.length > 0 ? rest.join(' ') : await readStdin()).trim()
if (!prompt) {
  console.error('프롬프트가 비어 있습니다.')
  process.exit(1)
}

const url = base + encodePromptHash(prompt)

// 브라우저/OS의 URL 길이 한계에 걸리기 전에 알려준다. 넘으면 클립보드 경로를 써야 한다.
if (url.length > 8000) {
  console.error(`⚠️ URL이 ${url.length}자입니다 — 길이 제한에 걸릴 수 있습니다.`)
}

if (urlOnly) {
  console.log(url)
} else {
  openUrl(url)
  console.log(`${site} 열었습니다 (프롬프트 ${prompt.length}자)`)
}
