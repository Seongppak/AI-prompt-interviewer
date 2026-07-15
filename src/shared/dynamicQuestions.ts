import type { Question } from './question'

export interface DynamicQuestionsState {
  status: 'loading' | 'ready' | 'error'
  questions: Question[]
  error?: string
}

const STORAGE_KEY = 'dynamic_questions'

export async function getDynamicQuestions(): Promise<DynamicQuestionsState | null> {
  const { [STORAGE_KEY]: existing } = await chrome.storage.local.get(STORAGE_KEY)
  return (existing as DynamicQuestionsState) ?? null
}

export async function setDynamicQuestions(state: DynamicQuestionsState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

export async function clearDynamicQuestions(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}
