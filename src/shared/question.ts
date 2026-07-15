export interface QuestionOption {
  label: string
  value: string
}

export interface Question {
  id: string
  text: string
  // os/language/detail_level처럼 여러 프로젝트에서 반복될 수 있는 보편적 주제의 안정적인 슬러그.
  // 이 프로젝트에만 해당하는 구체적인 질문이면 비어 있을 수 있다.
  category?: string
  options: QuestionOption[]
}
