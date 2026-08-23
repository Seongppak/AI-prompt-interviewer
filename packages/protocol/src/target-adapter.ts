export interface TargetAdapter {
  readonly id: string
  detect(): Promise<boolean>
  receivePrompt(): Promise<string | null>
  sendPrompt(prompt: string): Promise<void>
}
