export type GenerationPurpose = 'interview-questions' | 'prompt-optimization'

export interface GenerateRequest {
  purpose: GenerationPurpose
  prompt: string
  responseFormat?: 'text' | 'json'
  schema?: unknown
  timeoutMs?: number
}

export interface GenerateResponse {
  text: string
  model?: string
}

export interface AIProvider {
  generate(request: GenerateRequest): Promise<GenerateResponse>
}
