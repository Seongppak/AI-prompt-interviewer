import { describe, expect, it } from 'vitest'
import { buildStructuredPrompt, findTargetProfile } from '../src'

describe('buildStructuredPrompt', () => {
  it('금융 도서 요청을 역할·조건·본문 구조가 있는 새 프롬프트로 재작성한다', () => {
    const result = buildStructuredPrompt({
      originalPrompt: '한국 증권 시장에서 사용 가능한 전술들을 다룬 책을 만들어라.',
      interviewDecisions: [
        { question: '주요 독자는?', category: 'audience', answer: '중급 투자자' },
        { question: '전략 성격은?', category: 'strategy_type', answer: '퀀트 투자' },
        { question: '상세도는?', category: 'detail_level', answer: '상세함' },
      ],
      target: findTargetProfile('claude')!,
    })

    expect(result).toContain('퀀트 투자 전략가이자 전문 금융 도서 저자')
    expect(result).toContain('## 핵심 목표')
    expect(result).toContain('주요 대상 독자: 중급 투자자')
    expect(result).toContain('핵심 접근 방식: 퀀트 투자')
    expect(result).toContain('진입·청산 규칙')
    expect(result).toContain('전체 목차, 장별 본문')
    expect(result).not.toContain('주요 독자는?')
  })

  it('개발 요청에는 구현·테스트·검증 지침을 구성한다', () => {
    const result = buildStructuredPrompt({
      originalPrompt: 'React 쇼핑몰 앱을 만들어줘.',
      interviewDecisions: [{ question: '결과물은?', category: 'output_type', answer: '완성 결과물' }],
      target: findTargetProfile('codex')!,
    })
    expect(result).toContain('시니어 소프트웨어 엔지니어')
    expect(result).toContain('테스트와 빌드를 실행')
    expect(result).toContain('결과물 형태: 완성 결과물')
  })
})
