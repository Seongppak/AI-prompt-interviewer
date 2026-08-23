import { describe, expect, it } from 'vitest'
import { composePrompt, PromptBuilder, type Question } from '../src'

const questions: Question[] = [
  { id: 'os', text: '운영체제는?', options: [{ label: 'Windows', value: 'Windows' }, { label: 'macOS', value: 'macOS' }] },
  { id: 'language', text: '언어는?', options: [{ label: '한국어', value: '한국어' }, { label: '영어', value: '영어' }] },
]

describe('PromptBuilder', () => {
  it('preserves the original output when there are no answers', () => {
    expect(composePrompt('앱을 만들어줘', questions, {})).toBe('앱을 만들어줘')
  })

  it('preserves the legacy composed prompt format', () => {
    const expected = [
      '앱을 만들어줘',
      '',
      '다음 조건을 참고해서 답변해줘:',
      '- 운영체제는? Windows',
      '- 언어는? 한국어',
    ].join('\n')
    expect(new PromptBuilder().build({
      originalPrompt: '앱을 만들어줘',
      questions,
      answers: { os: 'Windows', language: '한국어' },
    })).toBe(expected)
  })

  it('omits skipped questions', () => {
    expect(composePrompt('앱', questions, { language: '한국어' })).not.toContain('운영체제는?')
  })
})
