import type { TargetGuidance, TargetGuidanceProvider } from '../ports/target-guidance-provider'

const COMMON_SECTION = '공통'
const NON_GUIDANCE_SECTIONS = new Set(['편집 규칙'])

export type TargetGuidanceMap = ReadonlyMap<string, string>

export function parseTargetGuidance(markdown: string): TargetGuidanceMap {
  const sections = new Map<string, string>()
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

function getGuidance(sections: TargetGuidanceMap, targetName: string): TargetGuidance {
  const common = sections.get(COMMON_SECTION.toLowerCase()) ?? ''
  const specific = sections.get(targetName.trim().toLowerCase()) ?? ''
  const blocks: string[] = []
  if (common) blocks.push(`## 공통 지침\n${common}`)
  if (specific) blocks.push(`## ${targetName} 지침\n${specific}`)

  return {
    targetName,
    common,
    specific,
    combined: blocks.join('\n\n'),
    hasSpecific: specific.length > 0,
  }
}

export class MarkdownTargetGuidanceProvider implements TargetGuidanceProvider {
  readonly sections: TargetGuidanceMap

  constructor(markdown: string) {
    this.sections = parseTargetGuidance(markdown)
  }

  async get(targetName: string): Promise<TargetGuidance> {
    return getGuidance(this.sections, targetName)
  }

  getSync(targetName: string): TargetGuidance {
    return getGuidance(this.sections, targetName)
  }
}
