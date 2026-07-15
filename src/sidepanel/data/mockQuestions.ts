export interface QuestionOption {
  label: string
  value: string
}

export interface Question {
  id: string
  text: string
  options: QuestionOption[]
}

export const mockQuestions: Question[] = [
  {
    id: 'os',
    text: '어떤 운영체제를 사용하고 계신가요?',
    options: [
      { label: 'Windows', value: 'Windows' },
      { label: 'macOS', value: 'macOS' },
      { label: 'Linux', value: 'Linux' },
    ],
  },
  {
    id: 'language',
    text: '답변은 어떤 언어로 받고 싶으신가요?',
    options: [
      { label: '한국어', value: '한국어' },
      { label: 'English', value: 'English' },
    ],
  },
  {
    id: 'detail',
    text: '답변의 상세도는 어느 정도가 좋을까요?',
    options: [
      { label: '간단히', value: '간단히' },
      { label: '자세히', value: '자세히' },
    ],
  },
]
