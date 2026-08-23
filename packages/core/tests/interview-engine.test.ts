import { describe, expect, it } from 'vitest'
import { InterviewEngine, type GeneratedInterview, type Question } from '../src'

const questions: Question[] = [
  {
    id: 'platform',
    text: '어느 플랫폼인가요?',
    options: [
      { label: 'Desktop', value: 'desktop' },
      { label: 'CLI', value: 'cli' },
    ],
  },
  {
    id: 'language',
    text: '어느 언어인가요?',
    options: [
      { label: '한국어', value: 'ko' },
      { label: '영어', value: 'en' },
    ],
  },
]

function createGenerated(): GeneratedInterview {
  return {
    questions,
    recommendation: {
      targetId: 'codex',
      displayName: 'Codex',
      reason: '코딩 작업입니다.',
    },
  }
}

describe('InterviewEngine', () => {
  const engine = new InterviewEngine()

  it('creates a deterministic generating session and trims the prompt', () => {
    const session = engine.create({
      id: 'session-1',
      originalPrompt: '  앱을 만들어줘  ',
      createdAt: '2026-08-23T00:00:00.000Z',
      sourceTargetId: 'chatgpt',
    })

    expect(session).toMatchObject({
      id: 'session-1',
      originalPrompt: '앱을 만들어줘',
      phase: 'generating',
      sourceTargetId: 'chatgpt',
      currentQuestionIndex: 0,
    })
  })

  it('moves through answer, previous, skip, and restart transitions immutably', () => {
    const created = engine.create({ id: '1', originalPrompt: '앱', createdAt: 'now' })
    const interviewing = engine.questionsGenerated(created, createGenerated())
    const answered = engine.answer(interviewing, 'platform', 'desktop')
    const previous = engine.previous(answered)
    const skipped = engine.skip(previous, 'platform')
    const ready = engine.answer(skipped, 'language', 'ko')
    const restarted = engine.restart(ready)

    expect(created.questions).toEqual([])
    expect(interviewing.phase).toBe('interviewing')
    expect(answered.answers).toEqual({ platform: 'desktop' })
    expect(previous.currentQuestionIndex).toBe(0)
    expect(skipped.answers).toEqual({})
    expect(ready.phase).toBe('ready')
    expect(restarted).toMatchObject({ phase: 'interviewing', answers: {}, currentQuestionIndex: 0 })
  })

  it('becomes ready immediately when no interview questions are needed', () => {
    const created = engine.create({ id: '1', originalPrompt: '충분한 질문', createdAt: 'now' })
    const ready = engine.questionsGenerated(created, { questions: [] })
    expect(ready.phase).toBe('ready')
  })

  it('rejects blank prompts and unknown question ids', () => {
    expect(() => engine.create({ id: '1', originalPrompt: ' ', createdAt: 'now' })).toThrow(
      '원본 프롬프트가 비어 있습니다.',
    )
    const session = engine.questionsGenerated(
      engine.create({ id: '1', originalPrompt: '앱', createdAt: 'now' }),
      createGenerated(),
    )
    expect(() => engine.answer(session, 'missing', 'value')).toThrow('존재하지 않는 질문입니다.')
  })

  it('prevents changes after cancellation', () => {
    const session = engine.cancel(engine.create({ id: '1', originalPrompt: '앱', createdAt: 'now' }))
    expect(() => engine.questionsGenerated(session, createGenerated())).toThrow(
      '취소된 인터뷰는 변경할 수 없습니다.',
    )
  })

  it('rejects answers and skips outside the interviewing phase', () => {
    const ready = engine.questionsGenerated(
      engine.create({ id: '1', originalPrompt: '앱', createdAt: 'now' }),
      { questions: [] },
    )
    expect(() => engine.answer(ready, 'missing', 'value')).toThrow(
      'ready 상태에서는 답변할 수 없습니다.',
    )
    expect(() => engine.skip(ready, 'missing')).toThrow(
      'ready 상태에서는 질문을 건너뛰기할 수 없습니다.',
    )
  })

  it('rejects duplicate question-generation completion', () => {
    const interviewing = engine.questionsGenerated(
      engine.create({ id: '1', originalPrompt: '앱', createdAt: 'now' }),
      createGenerated(),
    )
    expect(() => engine.questionsGenerated(interviewing, createGenerated())).toThrow(
      'interviewing 상태에서는 질문 생성을 완료할 수 없습니다.',
    )
  })
})
