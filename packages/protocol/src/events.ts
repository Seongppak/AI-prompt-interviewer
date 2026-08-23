import type { CoreError, GeneratedInterview } from '../../core/src'

export type AIPIEvent =
  | { type: 'INTERVIEW_GENERATION_REQUESTED'; sessionId: string }
  | { type: 'INTERVIEW_GENERATED'; sessionId: string; result: GeneratedInterview }
  | { type: 'INTERVIEW_COMPLETED'; sessionId: string }
  | { type: 'PROMPT_OPTIMIZED'; sessionId: string; targetId: string; prompt: string }
  | { type: 'PROMPT_DELIVERED'; targetId: string }
  | { type: 'ADAPTER_FAILED'; adapterId: string; error: CoreError }
