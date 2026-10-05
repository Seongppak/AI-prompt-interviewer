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
        expect(request.prompt).toContain('options 중 하나의 value를 그대로 복사')
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

  it('keeps the interview usable when a recommendation value is not an option', () => {
    const malformed = JSON.stringify({
      questions: [{
        id: 'language',
        text: '언어?',
        recommendedValue: 'fr',
        recommendedReason: '프랑스어가 적합합니다.',
        options: [{ label: '한국어', value: 'ko' }, { label: '영어', value: 'en' }],
      }],
    })
    const [question] = parseGeneratedInterview(malformed).questions
    expect(question.recommendedValue).toBeUndefined()
    expect(question.recommendedReason).toBeUndefined()
    expect(question.options).toEqual([{ label: '한국어', value: 'ko' }, { label: '영어', value: 'en' }])
  })

  it('recovers isolation_method when the provider returns an option label instead of its value', async () => {
    const provider: AIProvider = {
      async generate() {
        return { text: JSON.stringify({ questions: [{
          id: 'isolation_method',
          text: '어떤 격리 방식을 사용하나요?',
          recommendedValue: '  별도 작업 폴더  ',
          recommendedReason: '작업을 분리할 수 있습니다.',
          options: [
            { label: '별도 작업 폴더', value: 'worktree' },
            { label: '현재 폴더', value: 'current_directory' },
          ],
        }] }) }
      },
    }
    const [question] = (await new QuestionGenerationService(provider).generate('작업을 격리해줘')).questions
    expect(question.recommendedValue).toBe('worktree')
    expect(question.recommendedReason).toBe('작업을 분리할 수 있습니다.')
  })

  it('does not guess between duplicate labels and prioritizes an exact value over labels', () => {
    const response = (recommendedValue: string) => JSON.stringify({ questions: [{
      id: 'isolation_method', text: '격리 방식?', recommendedValue,
      recommendedReason: '추천 이유',
      options: [{ label: '동일 이름', value: 'first' }, { label: '동일 이름', value: 'second' }],
    }] })
    expect(parseGeneratedInterview(response('동일 이름')).questions[0].recommendedValue).toBeUndefined()
    expect(parseGeneratedInterview(response('second')).questions[0].recommendedValue).toBe('second')

    const collision = JSON.stringify({ questions: [{
      id: 'isolation_method', text: '격리 방식?', recommendedValue: 'worktree',
      options: [{ label: 'worktree', value: 'current_directory' }, { label: '별도 폴더', value: 'worktree' }],
    }] })
    expect(parseGeneratedInterview(collision).questions[0].recommendedValue).toBe('worktree')
  })

  it('still rejects structurally invalid options', () => {
    for (const options of [
      [{ label: 'A', value: 'a' }],
      [{ label: 'A', value: 'a' }, { label: 'B', value: 'a' }],
      [{ label: '', value: 'a' }, { label: 'B', value: 'b' }],
    ]) {
      expect(() => parseGeneratedInterview(JSON.stringify({ questions: [{
        id: 'isolation_method', text: '격리 방식?', recommendedValue: 'missing', options,
      }] }))).toThrow(AIPIError)
    }
  })

  it('moves directly to a no-question result for a sufficiently detailed prompt', () => {
    expect(parseGeneratedInterview('{"questions":[]}')).toEqual({
      questions: [],
      recommendation: undefined,
    })
  })
})
