export interface QuestionOption {
  label: string
  value: string
}

export interface Question {
  id: string
  text: string
  options: QuestionOption[]
}
