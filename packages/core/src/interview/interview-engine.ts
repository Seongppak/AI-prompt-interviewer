import { AIPIError, type CoreError } from '../types/result'
import type { GeneratedInterview, InterviewSession } from './interview-state'

export interface CreateInterviewInput {
  id: string
  originalPrompt: string
  createdAt: string
  sourceTargetId?: string
}

function ensureMutable(session: InterviewSession): void {
  if (session.phase === 'cancelled') {
    throw new AIPIError({
      code: 'INVALID_INPUT',
      message: '취소된 인터뷰는 변경할 수 없습니다.',
      retryable: false,
    })
  }
}

function ensurePhase(
  session: InterviewSession,
  allowed: readonly InterviewSession['phase'][],
  action: string,
): void {
  ensureMutable(session)
  if (!allowed.includes(session.phase)) {
    throw new AIPIError({
      code: 'INVALID_INPUT',
      message: `${session.phase} 상태에서는 ${action}할 수 없습니다.`,
      retryable: false,
    })
  }
}

export class InterviewEngine {
  create(input: CreateInterviewInput): InterviewSession {
    const originalPrompt = input.originalPrompt.trim()
    if (!originalPrompt) {
      throw new AIPIError({
        code: 'INVALID_INPUT',
        message: '원본 프롬프트가 비어 있습니다.',
        retryable: false,
      })
    }

    return {
      id: input.id,
      originalPrompt,
      createdAt: input.createdAt,
      phase: 'generating',
      sourceTargetId: input.sourceTargetId,
      questions: [],
      answers: {},
      currentQuestionIndex: 0,
    }
  }

  questionsGenerated(session: InterviewSession, result: GeneratedInterview): InterviewSession {
    ensurePhase(session, ['generating'], '질문 생성을 완료')
    return {
      ...session,
      phase: result.questions.length === 0 ? 'ready' : 'interviewing',
      questions: result.questions,
      answers: {},
      currentQuestionIndex: 0,
      recommendation: result.recommendation,
      error: undefined,
    }
  }

  answer(session: InterviewSession, questionId: string, value: string): InterviewSession {
    ensurePhase(session, ['interviewing'], '답변')
    const questionIndex = session.questions.findIndex((question) => question.id === questionId)
    const answer = value.trim()
    if (questionIndex === -1 || !answer) {
      throw new AIPIError({
        code: 'INVALID_INPUT',
        message: questionIndex === -1 ? '존재하지 않는 질문입니다.' : '답변이 비어 있습니다.',
        retryable: false,
      })
    }

    const nextIndex = Math.max(session.currentQuestionIndex, questionIndex + 1)
    return {
      ...session,
      phase: nextIndex >= session.questions.length ? 'ready' : 'interviewing',
      answers: { ...session.answers, [questionId]: answer },
      currentQuestionIndex: nextIndex,
    }
  }

  skip(session: InterviewSession, questionId: string): InterviewSession {
    ensurePhase(session, ['interviewing'], '질문을 건너뛰기')
    const questionIndex = session.questions.findIndex((question) => question.id === questionId)
    if (questionIndex === -1) {
      throw new AIPIError({
        code: 'INVALID_INPUT',
        message: '존재하지 않는 질문입니다.',
        retryable: false,
      })
    }

    const answers = { ...session.answers }
    delete answers[questionId]
    const nextIndex = Math.max(session.currentQuestionIndex, questionIndex + 1)
    return {
      ...session,
      phase: nextIndex >= session.questions.length ? 'ready' : 'interviewing',
      answers,
      currentQuestionIndex: nextIndex,
    }
  }

  previous(session: InterviewSession): InterviewSession {
    ensurePhase(session, ['interviewing', 'ready'], '이전 질문으로 이동')
    const currentQuestionIndex = Math.max(0, session.currentQuestionIndex - 1)
    return {
      ...session,
      phase: session.questions.length === 0 ? 'ready' : 'interviewing',
      currentQuestionIndex,
    }
  }

  restart(session: InterviewSession): InterviewSession {
    ensurePhase(session, ['interviewing', 'ready'], '인터뷰를 다시 시작')
    return {
      ...session,
      phase: session.questions.length === 0 ? 'ready' : 'interviewing',
      answers: {},
      currentQuestionIndex: 0,
      error: undefined,
    }
  }

  fail(session: InterviewSession, error: CoreError): InterviewSession {
    return { ...session, phase: 'error', error }
  }

  cancel(session: InterviewSession): InterviewSession {
    return { ...session, phase: 'cancelled' }
  }
}
