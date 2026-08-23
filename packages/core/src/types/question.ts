export interface QuestionOption {
  label: string
  value: string
}

export interface Question {
  id: string
  text: string
  category?: string
  recommendedValue?: string
  recommendedReason?: string
  options: QuestionOption[]
}
