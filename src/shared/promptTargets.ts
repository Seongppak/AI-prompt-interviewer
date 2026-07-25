// prompts/targets.md를 단일 원본으로 읽는다.
//
// 마크다운으로 둔 이유: 이 파일은 손으로 자주 고치는 지식 자산이고, Claude Code의
// optimize-prompt 스킬도 같은 파일을 직접 읽는다. TS 템플릿 리터럴로 두면 본문에
// 백틱을 못 쓰게 되어 편집이 불편해진다.
import targetsMarkdown from '../../prompts/targets.md?raw'

const COMMON_SECTION = '공통'

// 파일 앞부분의 설명/편집 규칙 섹션은 재작성 지시가 아니므로 제외한다.
const NON_GUIDANCE_SECTIONS = new Set(['편집 규칙'])

function parseSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>()

  // '## 이름' 을 경계로 자른다. 첫 조각은 h1과 도입부라 버린다.
  const parts = markdown.split(/^## +/m).slice(1)
  for (const part of parts) {
    const newline = part.indexOf('\n')
    if (newline === -1) continue

    const name = part.slice(0, newline).trim()
    const body = part.slice(newline + 1).trim()
    if (name && body && !NON_GUIDANCE_SECTIONS.has(name)) {
      sections.set(name.toLowerCase(), body)
    }
  }

  return sections
}

const SECTIONS = parseSections(targetsMarkdown)

// displayName은 대소문자/여백 차이가 있을 수 있어 느슨하게 비교한다 — sites.ts와 같은 방침.
function lookup(name: string): string | undefined {
  return SECTIONS.get(name.trim().toLowerCase())
}

/**
 * 대상 AI에 맞는 재작성 지침을 돌려준다. '공통'은 항상 함께 포함한다.
 * 아직 targets.md에 없는 대상이면 공통 지침만 나온다 — 호출부는 그대로 진행하면 된다.
 */
export function getTargetGuidance(targetName: string): string {
  const common = lookup(COMMON_SECTION)
  const specific = lookup(targetName)

  const blocks: string[] = []
  if (common) blocks.push(`## 공통 지침\n${common}`)
  if (specific) blocks.push(`## ${targetName} 지침\n${specific}`)

  return blocks.join('\n\n')
}

export function hasTargetGuidance(targetName: string): boolean {
  return lookup(targetName) !== undefined
}
