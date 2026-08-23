import type { TargetProfile } from '../target/target-profile'

export interface StructuredPromptDecision {
  question: string
  category?: string
  answer: string
}

export interface StructuredPromptInput {
  originalPrompt: string
  interviewDecisions: StructuredPromptDecision[]
  target: Pick<TargetProfile, 'id' | 'displayName'>
}

const CATEGORY_LABELS: Record<string, string> = {
  audience: '주요 대상 독자',
  target_audience: '주요 대상 독자',
  output_type: '결과물 형태',
  detail_level: '내용 및 설명 상세도',
  language: '작성 언어',
  strategy_type: '핵심 접근 방식',
  tone: '문체와 어조',
  platform: '대상 플랫폼',
  scope: '구현 범위',
}

function inferRole(prompt: string): string {
  if (/증권|주식|투자|금융|퀀트|포트폴리오/.test(prompt)) {
    return /책|도서|가이드북|교재/.test(prompt)
      ? '너는 한국 증권시장에 정통한 퀀트 투자 전략가이자 전문 금융 도서 저자다.'
      : '너는 시장 분석과 위험 관리에 능숙한 전문 금융 전략가다.'
  }
  if (/앱|웹|코드|프로그램|개발|구현|버그|API/.test(prompt)) {
    return '너는 요구사항을 실행 가능한 설계와 검증된 결과물로 완성하는 시니어 소프트웨어 엔지니어다.'
  }
  if (/보고서|분석|조사|리서치|비교/.test(prompt)) {
    return '너는 근거를 체계적으로 검토하고 명확한 결론을 제시하는 전문 리서처이자 분석가다.'
  }
  if (/책|도서|글|기사|콘텐츠|시나리오/.test(prompt)) {
    return '너는 독자와 목적에 맞춰 완성도 높은 결과물을 설계하는 전문 기획자이자 작가다.'
  }
  return '너는 사용자의 목적을 정확히 파악해 구체적이고 바로 활용 가능한 결과물을 만드는 분야 전문가다.'
}

function decisionLines(decisions: StructuredPromptDecision[]): string[] {
  return decisions.map((decision, index) => {
    const category = decision.category?.trim().toLowerCase() ?? ''
    const label = CATEGORY_LABELS[category] ?? `추가 확정 조건 ${index + 1}`
    return `- ${label}: ${decision.answer.trim()}`
  })
}

function executionInstructions(prompt: string): string[] {
  if (/증권|주식|투자|금융|퀀트/.test(prompt) && /책|도서|가이드북|교재/.test(prompt)) {
    return [
      '- 먼저 책의 목적, 예상 독자, 학습 흐름을 정의하고 전체 목차를 설계한다.',
      '- 각 투자 전술은 개념, 작동 논리, 필요한 데이터, 진입·청산 규칙, 위험 관리, 적용 예시 순서로 설명한다.',
      '- 백테스트 편향, 거래비용, 유동성, 세금과 제도 변화 등 한국 시장에서의 현실적인 제약을 함께 다룬다.',
      '- 독자가 전략을 재현하고 검증할 수 있도록 계산 기준과 점검 항목을 구체적으로 제시한다.',
    ]
  }
  if (/앱|웹|코드|프로그램|개발|구현|버그|API/.test(prompt)) {
    return [
      '- 먼저 기존 구조와 제약을 확인하고 구현 범위와 완료 기준을 명확히 정리한다.',
      '- 핵심 기능을 실제로 동작하는 코드로 구현하고 오류 처리와 경계 조건을 포함한다.',
      '- 관련 테스트와 빌드를 실행하고, 변경 파일과 검증 결과를 보고한다.',
    ]
  }
  if (/보고서|분석|조사|리서치|비교/.test(prompt)) {
    return [
      '- 핵심 질문과 평가 기준을 먼저 정의한다.',
      '- 주장과 사실, 해석을 구분하고 근거가 필요한 내용에는 확인 가능한 출처를 제시한다.',
      '- 분석 결과를 비교·종합해 실질적인 결론과 다음 행동을 도출한다.',
    ]
  }
  return [
    '- 요청의 목적과 독자를 먼저 파악하고 결과물의 논리적인 전체 구조를 설계한다.',
    '- 추상적인 설명에 그치지 말고 구체적인 근거, 절차, 예시를 포함한다.',
    '- 불확실한 내용은 사실처럼 단정하지 말고 필요한 가정이나 한계를 명시한다.',
  ]
}

function outputInstructions(prompt: string): string[] {
  if (/책|도서|가이드북|교재/.test(prompt)) {
    return [
      '- 마크다운 헤더로 제목, 책의 목적과 독자, 전체 목차, 장별 본문을 구분한다.',
      '- 각 장은 핵심 개념, 상세 설명, 실제 예시, 주의사항, 독자 점검 항목을 포함한다.',
      '- 서론과 결론만 제시하지 말고 요청된 본문을 실제로 작성한다.',
    ]
  }
  if (/앱|웹|코드|프로그램|개발|구현|버그|API/.test(prompt)) {
    return [
      '- 필요한 경우 파일별 코드 블록과 파일 경로를 명확히 구분한다.',
      '- 실행 방법, 테스트 방법, 주요 설계 결정과 남은 제약을 함께 제시한다.',
    ]
  }
  return [
    '- 마크다운 헤더와 목록을 사용해 결과를 읽기 쉬운 섹션으로 나눈다.',
    '- 핵심 결과를 먼저 제시하고 세부 근거와 실행 항목을 뒤에 배치한다.',
  ]
}

export function buildStructuredPrompt(input: StructuredPromptInput): string {
  const original = input.originalPrompt.trim()
  const decisions = decisionLines(input.interviewDecisions)
  return [
    '## 역할',
    inferRole(original),
    '',
    '## 핵심 목표',
    original,
    '',
    ...(decisions.length ? ['## 확정된 요구사항', ...decisions, ''] : []),
    '## 수행 지침',
    ...executionInstructions(original),
    '',
    '## 출력 형식 및 구조',
    ...outputInstructions(original),
    '',
    '## 품질 기준',
    '- 원래 요청과 확정된 요구사항을 빠짐없이 반영한다.',
    '- 일반론이나 목차 초안에서 멈추지 말고 바로 사용할 수 있는 완성 결과물을 작성한다.',
    '- 중복 표현과 불필요한 서론을 줄이고 정확성, 구체성, 실행 가능성을 우선한다.',
    `- ${input.target.displayName}가 지시를 오해하지 않도록 요구사항과 결과 형식을 명시적으로 작성한다.`,
  ].join('\n')
}
