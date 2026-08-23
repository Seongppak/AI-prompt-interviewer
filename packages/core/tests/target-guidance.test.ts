import { describe, expect, it } from 'vitest'
import { MarkdownTargetGuidanceProvider, parseTargetGuidance } from '../src'

const markdown = `# 규칙

## 편집 규칙
제외한다.

## 공통
목표를 명확히 한다.

## ChatGPT
헤더를 사용한다.
`

describe('Target Guidance', () => {
  it('parses guidance sections and excludes editing metadata', () => {
    const sections = parseTargetGuidance(markdown)
    expect(sections.get('공통')).toContain('목표')
    expect(sections.has('편집 규칙')).toBe(false)
  })

  it('combines common and target-specific guidance', async () => {
    const guidance = await new MarkdownTargetGuidanceProvider(markdown).get('ChatGPT')
    expect(guidance.hasSpecific).toBe(true)
    expect(guidance.combined).toContain('공통 지침')
    expect(guidance.combined).toContain('ChatGPT 지침')
  })

  it('falls back to common guidance for unknown targets', async () => {
    const guidance = await new MarkdownTargetGuidanceProvider(markdown).get('Codex')
    expect(guidance.hasSpecific).toBe(false)
    expect(guidance.combined).toContain('목표를 명확히 한다.')
  })
})
