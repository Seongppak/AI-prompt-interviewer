import { describe, expect, it } from 'vitest'
import targetsMarkdown from '../../../prompts/targets.md?raw'
import {
  collectInterviewDecisions,
  InterviewEngine,
  MarkdownTargetGuidanceProvider,
  PromptOptimizer,
  QuestionGenerationService,
  findTargetProfile,
} from '../../../packages/core/src'
import { FakeAIProvider } from '../src/fakeAIProvider'

describe('Test App full Core flow', () => {
  const provider = new FakeAIProvider()
  const engine = new InterviewEngine()
  const generator = new QuestionGenerationService(provider)
  const optimizer = new PromptOptimizer(
    provider,
    new MarkdownTargetGuidanceProvider(targetsMarkdown),
  )

  it('intercepts, interviews, recommends Codex, optimizes, and prepares delivery', async () => {
    const originalPrompt = 'React로 상품 검색과 장바구니가 있는 쇼핑몰 웹사이트를 만들어줘.'
    const created = engine.create({
      id: 'test-session',
      originalPrompt,
      createdAt: '2026-08-23T00:00:00.000Z',
      sourceTargetId: 'chatgpt',
    })
    const generated = await generator.generate(originalPrompt)
    let session = engine.questionsGenerated(created, generated)

    expect(generated.recommendation?.targetId).toBe('codex')
    expect(session.phase).toBe('interviewing')

    session = engine.answer(session, 'output_type', '완성 결과물')
    session = engine.answer(session, 'detail_level', '구현 가능한 수준')
    session = engine.skip(session, 'language')
    expect(session.phase).toBe('ready')

    const target = findTargetProfile(generated.recommendation!.targetId)!
    const optimized = await optimizer.optimize({
      originalPrompt: session.originalPrompt,
      interviewDecisions: collectInterviewDecisions(session.questions, session.answers),
      target,
    })

    expect(optimized.optimized).toBe(true)
    expect(optimized.targetId).toBe('codex')
    expect(optimized.prompt).toContain('## 수행 지침')
    expect(optimized.prompt).toContain('React로 상품 검색과 장바구니가 있는 쇼핑몰 웹사이트')
    expect(optimized.prompt).toContain('결과물 형태: 완성 결과물')
    expect(optimized.prompt).toContain('내용 및 설명 상세도: 구현 가능한 수준')
    expect(optimized.prompt).not.toContain('어떤 형태의 결과물이 필요합니까?')
    expect(optimized.prompt).not.toContain('다음 조건을 참고해서 답변해줘')
  })

  it('recommends Perplexity for current research with sources', async () => {
    const generated = await generator.generate('2026년 최신 AI 시장을 조사하고 출처와 함께 비교해줘.')
    expect(generated.recommendation).toMatchObject({
      targetId: 'perplexity',
      displayName: 'Perplexity',
    })
  })

  it('rewrites a short finance-book request into a detailed production prompt', async () => {
    const originalPrompt = '한국 증권 시장에서 사용 가능한 전술들을 다룬 책을 만들어라.'
    const generated = await generator.generate(originalPrompt)
    expect(generated.recommendation?.targetId).toBe('claude')
    expect(generated.questions.map(({ id }) => id)).toEqual(['audience', 'strategy_type', 'detail_level'])

    let session = engine.questionsGenerated(
      engine.create({ id: 'finance-book', originalPrompt, createdAt: 'now', sourceTargetId: 'chatgpt' }),
      generated,
    )
    session = engine.answer(session, 'audience', '중급 투자자')
    session = engine.answer(session, 'strategy_type', '퀀트 투자')
    session = engine.answer(session, 'detail_level', '상세함')

    const optimized = await optimizer.optimize({
      originalPrompt,
      interviewDecisions: collectInterviewDecisions(session.questions, session.answers),
      target: findTargetProfile('claude')!,
    })
    expect(optimized.prompt).toContain('퀀트 투자 전략가이자 전문 금융 도서 저자')
    expect(optimized.prompt).toContain('주요 대상 독자: 중급 투자자')
    expect(optimized.prompt).toContain('핵심 접근 방식: 퀀트 투자')
    expect(optimized.prompt).toContain('필요한 데이터, 진입·청산 규칙, 위험 관리')
    expect(optimized.prompt).toContain('전체 목차, 장별 본문')
    expect(optimized.prompt).not.toContain('이 책의 주요 대상 독자는 누구입니까?')
  })

  it('skips the interview when the prompt is already sufficiently detailed', async () => {
    const detailedPrompt = [
      'TypeScript CLI 프로그램을 작성해줘.',
      '대상 사용자는 Windows 11 개발자이며 출력 형식은 Markdown이다.',
      '언어는 한국어이고 조건은 Node.js 24, strict TypeScript, Vitest 테스트 포함이다.',
      '제약 사항으로 외부 런타임 의존성을 추가하지 말고, 파일 구조와 실행 명령을 함께 제공한다.',
      '오류 처리 기준과 테스트 시나리오도 명시한다.',
    ].join(' ')
    const generated = await generator.generate(detailedPrompt)
    const session = engine.questionsGenerated(
      engine.create({ id: 'detailed', originalPrompt: detailedPrompt, createdAt: 'now' }),
      generated,
    )
    expect(generated.questions).toEqual([])
    expect(session.phase).toBe('ready')
  })
})
