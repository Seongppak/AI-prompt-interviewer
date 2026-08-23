import { useState } from 'react'
import targetsMarkdown from '../../../prompts/targets.md?raw'
import { GeminiAIProvider } from '../../../adapters/gemini/src'
import {
  collectInterviewDecisions,
  DEFAULT_TARGET_PROFILES,
  InterviewEngine,
  MarkdownTargetGuidanceProvider,
  PreferenceService,
  PromptOptimizer,
  QuestionGenerationService,
  findTargetProfile,
  type InterviewSession,
} from '../../../packages/core/src'
import { FakeAIProvider } from './fakeAIProvider'
import { InMemoryStorageAdapter } from './inMemoryStorageAdapter'

type TestLogLevel = 'info' | 'warn' | 'error'

interface TestLogEntry {
  id: number
  timestamp: string
  level: TestLogLevel
  scope: string
  message: string
  data?: Record<string, string | number | boolean>
}

let nextLogId = 1
const engine = new InterviewEngine()
const fakeProvider = new FakeAIProvider()
const guidanceProvider = new MarkdownTargetGuidanceProvider(targetsMarkdown)
const preferenceService = new PreferenceService(new InMemoryStorageAdapter())

function phaseLabel(session: InterviewSession | null): string {
  switch (session?.phase) {
    case 'generating': return '질문 분석 중'
    case 'interviewing': return '인터뷰 진행 중'
    case 'ready': return '최적화 준비 완료'
    case 'error': return '오류 발생'
    case 'cancelled': return '취소됨'
    default: return '가로채기 대기'
  }
}

export function App() {
  const [originalPrompt, setOriginalPrompt] = useState(
    'React로 상품 검색과 장바구니가 있는 쇼핑몰 웹사이트를 만들어줘.',
  )
  const [targetId, setTargetId] = useState('chatgpt')
  const [providerMode, setProviderMode] = useState<'fake' | 'gemini'>('fake')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [customAnswer, setCustomAnswer] = useState('')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [preferredValues, setPreferredValues] = useState<Record<string, string>>({})
  const [logsVisible, setLogsVisible] = useState(false)
  const [logs, setLogs] = useState<TestLogEntry[]>(() => [
    {
      id: nextLogId++,
      timestamp: new Date().toISOString(),
      level: 'info',
      scope: 'test-app',
      message: 'STEP 2 Core 테스트 앱을 시작했습니다.',
    },
  ])

  const target = findTargetProfile(targetId) ?? DEFAULT_TARGET_PROFILES[0]!
  const currentQuestion = session?.questions[session.currentQuestionIndex]
  const guidance = guidanceProvider.getSync(target.guidanceKey)
  const outputPrompt = optimizedPrompt || session?.originalPrompt || originalPrompt.trim()

  function activeProvider() {
    return providerMode === 'gemini'
      ? new GeminiAIProvider({ apiKey: geminiApiKey.trim() })
      : fakeProvider
  }

  function addLog(level: TestLogLevel, scope: string, message: string, data?: TestLogEntry['data']) {
    setLogs((current) => [...current, {
      id: nextLogId++,
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      data,
    }].slice(-200))
  }

  async function startInterview() {
    const prompt = originalPrompt.trim()
    if (!prompt) {
      addLog('error', 'capture', '가로챌 프롬프트가 비어 있습니다.')
      return
    }
    if (providerMode === 'gemini' && !geminiApiKey.trim()) {
      addLog('error', 'gemini', 'Gemini API 키를 입력해야 실제 API 검증을 시작할 수 있습니다.')
      return
    }

    const created = engine.create({
      id: crypto.randomUUID(),
      originalPrompt: prompt,
      createdAt: new Date().toISOString(),
      sourceTargetId: targetId,
    })
    setSession(created)
    setOptimizedPrompt('')
    setDelivered(false)
    setCustomAnswer('')
    addLog('info', 'capture', '프롬프트 입력을 가로챘습니다.', { promptLength: prompt.length })

    try {
      const generated = await new QuestionGenerationService(activeProvider()).generate(prompt)
      const next = engine.questionsGenerated(created, generated)
      setSession(next)
      if (generated.recommendation) setTargetId(generated.recommendation.targetId)
      addLog('info', 'interview', 'Core가 인터뷰 질문과 AI 추천을 생성했습니다.', {
        questions: generated.questions.length,
        recommendedTarget: generated.recommendation?.targetId ?? 'none',
      })
    } catch (error) {
      setSession(engine.fail(created, {
        code: 'INVALID_AI_RESPONSE',
        message: String(error),
        retryable: true,
        cause: error,
      }))
      addLog('error', 'interview', '질문 생성에 실패했습니다.', { error: String(error) })
    }
  }

  function answer(value: string) {
    if (!session || !currentQuestion) return
    setSession(engine.answer(session, currentQuestion.id, value))
    if (currentQuestion.category) {
      void preferenceService.record(currentQuestion.category, value)
        .then(() => preferenceService.getPreferredValues())
        .then(setPreferredValues)
    }
    setOptimizedPrompt('')
    setDelivered(false)
    setCustomAnswer('')
    addLog('info', 'interview', '질문에 답했습니다.', {
      questionId: currentQuestion.id,
      answerLength: value.length,
      customAnswer: !currentQuestion.options.some((option) => option.value === value),
    })
  }

  function skip() {
    if (!session || !currentQuestion) return
    setSession(engine.skip(session, currentQuestion.id))
    setCustomAnswer('')
    setOptimizedPrompt('')
    setDelivered(false)
    addLog('warn', 'interview', '질문을 건너뛰었습니다.', { questionId: currentQuestion.id })
  }

  function back() {
    if (!session) return
    setSession(engine.previous(session))
    setOptimizedPrompt('')
    setDelivered(false)
    setCustomAnswer('')
    addLog('info', 'interview', '이전 질문으로 이동했습니다.')
  }

  function restart() {
    if (!session) return
    setSession(engine.restart(session))
    setOptimizedPrompt('')
    setDelivered(false)
    setCustomAnswer('')
    addLog('info', 'interview', '인터뷰 답변을 초기화했습니다.')
  }

  async function optimize() {
    if (!session || session.phase !== 'ready') return
    setIsOptimizing(true)
    setDelivered(false)
    addLog('info', 'optimizer', '대상별 프롬프트 최적화를 시작했습니다.', { target: target.id })
    try {
      const result = await new PromptOptimizer(activeProvider(), guidanceProvider).optimizeBestEffort({
        originalPrompt: session.originalPrompt,
        interviewDecisions: collectInterviewDecisions(session.questions, session.answers),
        target,
      })
      setOptimizedPrompt(result.prompt)
      addLog(result.optimized ? 'info' : 'warn', 'optimizer', result.optimized
        ? 'Core 프롬프트 최적화를 완료했습니다.'
        : '최적화에 실패해 조립된 프롬프트로 대체했습니다.', {
        target: target.id,
        optimized: result.optimized,
        promptLength: result.prompt.length,
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  function simulateDelivery() {
    if (!optimizedPrompt) return
    setDelivered(true)
    addLog('info', 'delivery', '대상 AI 입력창 전달을 시뮬레이션했습니다.', {
      target: target.id,
      promptLength: optimizedPrompt.length,
    })
  }

  function resetAll() {
    setSession(null)
    setOptimizedPrompt('')
    setDelivered(false)
    setCustomAnswer('')
    addLog('info', 'test-app', '전체 검증 흐름을 초기화했습니다.')
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(outputPrompt)
      addLog('info', 'prompt', '현재 결과를 클립보드에 복사했습니다.', { promptLength: outputPrompt.length })
    } catch {
      addLog('error', 'prompt', '클립보드 복사에 실패했습니다.')
    }
  }

  function downloadLogs() {
    const text = logs.map((entry) => {
      const data = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
      return `[${entry.timestamp}] [${entry.level}] [${entry.scope}] ${entry.message}${data}`
    }).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'aipi-test-app.log'
    anchor.click()
    URL.revokeObjectURL(url)
    addLog('info', 'debug', '로그 파일을 다운로드했습니다.', { entries: logs.length })
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">STEP 2 · CORE VALIDATION</p>
          <h1>AI Prompt Interviewer <span>Test App</span></h1>
          <p className="hero-copy">가로채기부터 AI 추천·최적화·전달까지 새 Core 흐름을 검증합니다.</p>
        </div>
        <div className="hero-actions">
          <button className="log-menu-button" type="button" onClick={() => {
            setLogsVisible(true)
            addLog('info', 'debug', '로그 메뉴를 열었습니다.')
          }}>로그 확인 <span>{logs.length}</span></button>
          <div className="safety-badge"><strong>{providerMode === 'gemini' ? 'Gemini API' : 'Fake API'}</strong><span>{providerMode === 'gemini' ? '키는 메모리에만 유지' : '실제 AI·Chrome·Storage 미사용'}</span></div>
        </div>
      </header>

      <section className="flow-strip" aria-label="Core 검증 단계">
        {['입력 가로채기', '질문 생성', 'AI 추천', '답변 수집', '프롬프트 최적화', '입력 전달'].map((step, index) => (
          <span key={step}><b>{index + 1}</b>{step}</span>
        ))}
      </section>

      <section className="workspace">
        <div className="panel interview-panel">
          <div className="panel-heading">
            <div><span className="step-label">01 / CAPTURE & INTERVIEW</span><h2>{phaseLabel(session)}</h2></div>
            <button className="ghost-button" type="button" onClick={resetAll}>전체 초기화</button>
          </div>

          <label htmlFor="prompt">가로챌 원본 프롬프트</label>
          <textarea id="prompt" value={originalPrompt} disabled={session?.phase === 'generating'} onChange={(event) => {
            setOriginalPrompt(event.target.value)
            setSession(null)
            setOptimizedPrompt('')
            setDelivered(false)
          }} onBlur={() => addLog('info', 'prompt', '원본 프롬프트를 변경했습니다.', {
            promptLength: originalPrompt.trim().length,
          })} />

          <div className="provider-settings">
            <label htmlFor="provider">인터뷰·프롬프트 재작성 엔진</label>
            <select id="provider" value={providerMode} onChange={(event) => {
              const mode = event.target.value as 'fake' | 'gemini'
              setProviderMode(mode)
              setSession(null)
              setOptimizedPrompt('')
              setDelivered(false)
              addLog('info', 'provider', 'AI Provider를 변경했습니다.', { provider: mode })
            }}>
              <option value="fake">시뮬레이션 (API 키 불필요)</option>
              <option value="gemini">실제 Gemini API</option>
            </select>
            {providerMode === 'gemini' && <>
              <label htmlFor="gemini-api-key">Gemini API 키</label>
              <input
                id="gemini-api-key"
                type="password"
                autoComplete="off"
                value={geminiApiKey}
                onChange={(event) => setGeminiApiKey(event.target.value)}
                placeholder="Google AI Studio API 키"
              />
              <small>테스트 앱 메모리에만 보관하며 저장·로그·기존 확장 프로그램과 공유하지 않습니다.</small>
            </>}
          </div>

          {!session && <button className="capture-button" type="button" onClick={startInterview} disabled={!originalPrompt.trim()}>
            프롬프트 가로채기 시뮬레이션
          </button>}
          {session?.phase === 'generating' && <div className="loading-card"><i /> {providerMode === 'gemini' ? 'Gemini API' : 'Fake API'}가 질문과 추천 AI를 분석하고 있습니다.</div>}
          {session?.phase === 'error' && <div className="error-card">{session.error?.message}</div>}

          {session?.recommendation && <section className="recommendation-card">
            <div><span>AI RECOMMENDATION</span><h3>{session.recommendation.displayName}</h3></div>
            <p>{session.recommendation.reason}</p>
            <small>추천 대상이 자동 선택됐습니다. 아래에서 언제든 변경할 수 있습니다.</small>
          </section>}

          {session && session.phase !== 'generating' && session.phase !== 'error' && <>
            <label htmlFor="target">최적화 및 전달 대상 AI</label>
            <select id="target" value={targetId} onChange={(event) => {
              const nextTarget = event.target.value
              setTargetId(nextTarget)
              setOptimizedPrompt('')
              setDelivered(false)
              addLog('info', 'target', '대상 AI를 직접 변경했습니다.', { target: nextTarget })
            }}>
              {DEFAULT_TARGET_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
            </select>
          </>}

          {session?.phase === 'interviewing' && currentQuestion && <section className="question-card">
            <div className="progress-row"><span>INTERVIEW</span><span>{session.currentQuestionIndex + 1} / {session.questions.length}</span></div>
            <div className="progress-track"><span style={{ width: `${((session.currentQuestionIndex + 1) / session.questions.length) * 100}%` }} /></div>
            <h3>{currentQuestion.text}</h3>
            {currentQuestion.recommendedReason && <p className="recommendation">추천 기준 · {currentQuestion.recommendedReason}</p>}
            <div className="option-list">{currentQuestion.options.map((option) => {
              const isPreferred = !!currentQuestion.category
                && preferredValues[currentQuestion.category] === option.value
              return <button type="button" key={option.value} onClick={() => answer(option.value)}>
                <span>{isPreferred ? '⭐ ' : ''}{option.label}</span>
                {option.value === currentQuestion.recommendedValue && <em>AI 추천</em>}
              </button>
            })}</div>
            <div className="custom-answer-row">
              <input value={customAnswer} onChange={(event) => setCustomAnswer(event.target.value)} placeholder="직접 답변 입력" />
              <button type="button" onClick={() => answer(customAnswer)} disabled={!customAnswer.trim()}>확인</button>
            </div>
            <div className="nav-row">
              <button type="button" className="text-button" onClick={back} disabled={session.currentQuestionIndex === 0}>이전</button>
              <button type="button" className="text-button" onClick={skip}>건너뛰기</button>
            </div>
          </section>}

          {session?.phase === 'ready' && <section className="done-card">
            <span>INTERVIEW COMPLETE</span>
            <h3>답변 수집이 끝났습니다. {target.displayName}용 최적화를 실행하세요.</h3>
            <div className="done-actions">
              {session.questions.length > 0 && <button type="button" onClick={restart}>인터뷰 다시 하기</button>}
              <button className="primary-button" type="button" onClick={optimize} disabled={isOptimizing}>
                {isOptimizing ? '최적화 중…' : `${target.displayName}용 프롬프트 최적화`}
              </button>
            </div>
          </section>}
        </div>

        <div className="result-column">
          <section className="panel result-panel">
            <div className="panel-heading">
              <div><span className="step-label">02 / OPTIMIZED OUTPUT</span><h2>{optimizedPrompt ? '인터뷰가 반영된 최종 프롬프트' : '수정 전 원본 프롬프트'}</h2></div>
              <button className="primary-button" type="button" onClick={copyResult} disabled={!outputPrompt}>복사</button>
            </div>
            <pre>{outputPrompt || '원본 프롬프트를 입력하세요.'}</pre>
            {session?.phase === 'ready' && !optimizedPrompt && <p className="rewrite-notice">
              최적화를 실행하면 {providerMode === 'gemini' ? 'Gemini가' : '시뮬레이션 엔진이'} 질문·답변을 뒤에 붙이지 않고, 확정된 내용을 원문에 통합해 새로운 프롬프트를 작성합니다.
            </p>}
            {optimizedPrompt && <div className="delivery-row">
              <button type="button" onClick={simulateDelivery}>{target.displayName} 입력 시뮬레이션</button>
              <span className={delivered ? 'delivered' : ''}>{delivered ? '✓ 입력 전달 시뮬레이션 완료' : '실제 Browser 전달은 STEP 3에서 연결'}</span>
            </div>}
          </section>

          <section className="panel guidance-panel">
            <span className="step-label">03 / TARGET RULES</span><h2>{target.displayName}</h2>
            <p className={guidance.hasSpecific ? 'status-ok' : 'status-warn'}>{guidance.hasSpecific
              ? `${target.displayName} 전용 지침과 공통 지침을 함께 사용합니다.`
              : `${target.displayName} 전용 지침이 없어 공통 지침만 사용합니다.`}</p>
            <details><summary>Core에 주입된 지침 보기</summary><pre>{guidance.combined || '적용 가능한 지침이 없습니다.'}</pre></details>
          </section>
          <section className="validation-strip"><span><i /> packages/core 사용</span><span><i /> {providerMode === 'gemini' ? 'Gemini 재작성 모드' : 'Fake AI Provider'}</span><span><i /> 운영 배포 없음</span></section>
        </div>
      </section>

      {logsVisible && <div className="log-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setLogsVisible(false)
      }}><aside className="log-drawer" role="dialog" aria-modal="true" aria-label="테스트 로그">
        <header><div><span className="step-label">DEBUG CONSOLE</span><h2>테스트 로그</h2><p>현재 세션의 최근 로그 최대 200개를 표시합니다.</p></div>
          <button type="button" className="log-close" onClick={() => setLogsVisible(false)} aria-label="로그 닫기">×</button></header>
        <div className="log-toolbar"><span>{logs.length} entries</span><div>
          <button type="button" onClick={downloadLogs} disabled={logs.length === 0}>다운로드</button>
          <button type="button" onClick={() => setLogs([])} disabled={logs.length === 0}>지우기</button>
        </div></div>
        <div className="log-list">{logs.length === 0 ? <p className="empty-logs">기록된 로그가 없습니다.</p> : logs.slice().reverse().map((entry) => <article className={`log-entry log-${entry.level}`} key={entry.id}>
          <div className="log-entry-meta"><span>{entry.level}</span><code>{entry.scope}</code><time>{new Date(entry.timestamp).toLocaleTimeString('ko-KR')}</time></div>
          <p>{entry.message}</p>{entry.data && <pre>{JSON.stringify(entry.data, null, 2)}</pre>}
        </article>)}</div>
      </aside></div>}
    </main>
  )
}
