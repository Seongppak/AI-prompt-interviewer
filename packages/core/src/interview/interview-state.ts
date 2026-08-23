import type { Question } from '../types/question'
import type { CoreError } from '../types/result'

export type InterviewPhase =
  | 'generating'
  | 'interviewing'
  | 'ready'
  | 'error'
  | 'cancelled'

export interface TargetRecommendation {
  targetId: string
  displayName: string
  reason: string
}

export interface GeneratedInterview {
  questions: Question[]
  recommendation?: TargetRecommendation
}

export interface InterviewSession {
  id: string
  originalPrompt: string
  createdAt: string
  phase: InterviewPhase
  sourceTargetId?: string
  questions: Question[]
  answers: Record<string, string>
  currentQuestionIndex: number
  recommendation?: TargetRecommendation
  error?: CoreError
}
