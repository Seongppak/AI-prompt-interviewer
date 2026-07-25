// 새 기기에서 이 저장소를 쓸 수 있게 만든다. clone 직후 한 번 실행한다.
//
//   npm run setup
//
// 여러 번 실행해도 안전하다 — 이미 된 단계는 건너뛴다.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsSource = join(repoRoot, 'skills')
const skillsTarget = join(homedir(), '.claude', 'skills')

let failed = false

function step(label, fn) {
  process.stdout.write(`\n▶ ${label}\n`)
  try {
    fn()
  } catch (err) {
    failed = true
    console.error(`  ✗ 실패: ${err.message}`)
  }
}

// npm은 Windows에서 npm.cmd라 shell을 거쳐야 한다.
function run(command) {
  const res = spawnSync(command, { cwd: repoRoot, stdio: 'inherit', shell: true })
  if (res.status !== 0) throw new Error(`\`${command}\` 종료 코드 ${res.status}`)
}

step('의존성 설치 (npm install)', () => {
  run('npm install')
})

step('확장 빌드 (npm run build)', () => {
  run('npm run build')
})

// 스킬은 이 저장소가 단일 원본이다. ~/.claude/skills에서 여기를 가리키게 연결해두면
// git pull만으로 두 기기의 스킬이 같아진다.
step('Claude Code 스킬 연결', () => {
  if (!existsSync(skillsSource)) throw new Error(`${skillsSource} 가 없습니다`)
  mkdirSync(skillsTarget, { recursive: true })

  for (const name of readdirSync(skillsSource)) {
    const from = join(skillsTarget, name)
    const to = join(skillsSource, name)

    if (existsSync(from)) {
      console.log(`  · ${name} — 이미 연결됨, 건너뜀`)
      continue
    }

    // Windows의 디렉터리 junction은 관리자 권한이 필요 없다. symlink는 개발자 모드나
    // 관리자 권한을 요구해서 여기서는 쓰지 않는다.
    const res =
      process.platform === 'win32'
        ? spawnSync('cmd', ['/c', 'mklink', '/J', from, to], { stdio: 'pipe' })
        : spawnSync('ln', ['-s', to, from], { stdio: 'pipe' })

    if (res.status !== 0) {
      throw new Error(`${name} 연결 실패: ${String(res.stderr).trim()}`)
    }
    console.log(`  ✓ ${name} 연결됨`)
  }
})

console.log(`
${failed ? '⚠️  일부 단계가 실패했습니다. 위 오류를 보고 다시 실행하세요.' : '✅ 자동 설정 완료.'}

남은 건 손으로 해야 합니다 (자동화가 막혀 있는 부분):

  1. Chrome에서 chrome://extensions 열기
     → 개발자 모드 켜기 → "압축해제된 확장 프로그램을 로드"
     → 이 폴더 선택: ${join(repoRoot, 'dist')}

  2. 확장 사이드패널의 설정에서 Gemini API 키 입력
     (자격증명이라 기기 간 동기화하지 않습니다. 테마와 선호도는 자동으로 따라옵니다.)

  3. Claude Code 재시작
     ~/.claude/skills 를 새로 만든 경우에만 필요합니다. 이후 /inbox 와
     /optimize-prompt 가 뜹니다.

이후 업데이트는 \`npm run sync\` 한 줄이면 됩니다 (pull + build).
확장 코드가 바뀐 경우에는 chrome://extensions 에서 ↻ 리로드가 필요합니다.
`)

process.exit(failed ? 1 : 0)
