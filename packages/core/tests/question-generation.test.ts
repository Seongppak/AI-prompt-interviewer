import { describe, expect, it } from 'vitest'
import {
  AIPIError,
  QuestionGenerationService,
  parseGeneratedInterview,
  type AIProvider,
} from '../src'

const validResponse = JSON.stringify({
  questions: [
    {
      id: 'project_type',
      text: '어떤 형태인가요?',
      category: 'project_type',
      recommendedValue: 'desktop',
      recommendedReason: '현재 목표에 적합합니다.',
      options: [
        { label: 'Desktop', value: 'desktop' },
        { label: 'CLI', value: 'cli' },
      ],
    },
  ],
  recommendedTargetId: 'codex',
  recommendedTargetReason: '코딩 작업에 적합합니다.',
})

describe('QuestionGenerationService', () => {
  it('validates questions and normalizes a target recommendation', async () => {
    const provider: AIProvider = {
      async generate(request) {
        expect(request.purpose).toBe('interview-questions')
        expect(request.responseFormat).toBe('json')
        return { text: validResponse, model: 'fake-interviewer' }
      },
    }
    const result = await new QuestionGenerationService(provider).generate('앱을 만들어줘')

    expect(result.questions).toHaveLength(1)
    expect(result.recommendation).toEqual({
      targetId: 'codex',
      displayName: 'Codex',
      reason: '코딩 작업에 적합합니다.',
    })
  })

  it('accepts fenced JSON returned by a text-oriented provider', () => {
    expect(parseGeneratedInterview(`\`\`\`json\n${validResponse}\n\`\`\``).questions).toHaveLength(1)
  })

  it('rejects malformed question ids and duplicated options', () => {
    const malformed = JSON.stringify({
      questions: [{
        id: 'Bad ID',
        text: '질문',
        options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'a' }],
      }],
    })
    expect(() => parseGeneratedInterview(malformed)).toThrow(AIPIError)
  })

  it('rejects a recommendation value that is not an option', () => {
    const malformed = JSON.stringify({
      questions: [{
        id: 'language',
        text: '언어?',
        recommendedValue: 'fr',
        options: [{ label: '한국어', value: 'ko' }, { label: '영어', value: 'en' }],
      }],
    })
    expect(() => parseGeneratedInterview(malformed)).toThrow('추천값이 선택지에 없습니다.')
  })

  it('moves directly to a no-question result for a sufficiently detailed prompt', () => {
    expect(parseGeneratedInterview('{"questions":[]}')).toEqual({
      questions: [],
      recommendation: undefined,
    })
  })
})
