import { useEffect, useState } from 'react'
import targetsMarkdown from '../../../prompts/targets.md?raw'
import { GeminiAIProvider } from '../../../adapters/gemini/src'
import { DesktopChatTargetAdapter } from '../../../adapters/desktop/src'
import {
  collectInterviewDecisions,
  buildStructuredPrompt,
  DEFAULT_TARGET_PROFILES,
  findTargetProfile,
  InterviewEngine,
  MarkdownTargetGuidanceProvider,
  PreferenceService,
  PromptOptimizer,
  QuestionGenerationService,
  type InterviewSession,
} from '../../../packages/core/src'
import { FakeAIProvider } from '../../test-app/src/fakeAIProvider'
import { LocalStorageAdapter } from './local-storage-adapter'
import {
  DesktopProjectRepository,
  projectNameFromPrompt,
  type DesktopProject,
} from './project-repository'

const engine = new InterviewEngine()
const fakeProvider = new FakeAIProvider()
const guidanceProvider = new MarkdownTargetGuidanceProvider(targetsMarkdown)
const preferenceService = new PreferenceService(new LocalStorageAdapter())
const projectRepository = new DesktopProjectRepository(window.aipiDesktop.projects)

function phaseLabel(session: InterviewSession | null): string {
  if (!session) return '프롬프트 준비'
  if (session.phase === 'generating') return '필요한 정보 분석 중'
  if (session.phase === 'interviewing') return '인터뷰 진행 중'
  if (session.phase === 'ready') return '최종 프롬프트 준비 완료'
  if (session.phase === 'error') return '처리 오류'
  return '프롬프트 준비'
}

export function App() {
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [targetId, setTargetId] = useState('codex')
  const [providerMode, setProviderMode] = useState<'fake' | 'gemini'>('fake')
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [resultPrompt, setResultPrompt] = useState('')
  const [customAnswer, setCustomAnswer] = useState('')
  const [preferredValues, setPreferredValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('클립보드에서 프롬프트를 가져오거나 직접 입력하세요.')
  const [statusError, setStatusError] = useState(false)
  const [projects, setProjects] = useState<DesktopProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [captureShortcut, setCaptureShortcut] = useState('')
  const [interceptor, setInterceptor] = useState({ enabled: false, available: false, error: '' })
  const [capturedSourceTarget, setCapturedSourceTarget] = useState('')

  useEffect(() => {
    void preferenceService.getPreferredValues().then(setPreferredValues)
    void window.aipiDesktop.geminiApiKey.load().then((storedKey) => {
      if (!storedKey) return
      setApiKey(storedKey)
      setApiKeySaved(true)
      setProviderMode('gemini')
    }).catch((error) => setNotice(`저장된 API 키를 불러오지 못했습니다: ${String(error)}`, true))
    void projectRepository.list().then((stored) => {
      setProjects(stored)
      if (stored[0]) loadProject(stored[0])
    }).catch((error) => setNotice(`프로젝트 기록을 불러오지 못했습니다: ${String(error)}`, true))
  }, [])

  useEffect(() => {
    void window.aipiDesktop.interceptor.status().then(setInterceptor)
    const stopCapture = window.aipiDesktop.interceptor.onCapture((capture) => {
      setOriginalPrompt(capture.prompt)
      setActiveProjectId('')
      setProjectName('')
      setSession(null)
      setResultPrompt('')
      setCapturedSourceTarget(capture.target === 'test' ? '' : capture.target)
      if (capture.target !== 'test') setTargetId(capture.target)
      setNotice(`${capture.source}의 ${capture.trigger === 'enter' ? 'Enter' : '전송 버튼'} 입력을 가로챘습니다.`)
    })
    const stopStatus = window.aipiDesktop.interceptor.onStatus(setInterceptor)
    return () => { stopCapture(); stopStatus() }
  }, [])

  useEffect(() => {
    void window.aipiDesktop.captureShortcut().then(setCaptureShortcut)
    return window.aipiDesktop.onClipboardCapture(() => { void readClipboard(true) })
  }, [])

  const target = findTargetProfile(targetId) ?? DEFAULT_TARGET_PROFILES[0]!
  const question = session?.questions[session.currentQuestionIndex]
  const output = resultPrompt || session?.originalPrompt || originalPrompt.trim()

  function provider() {
    return providerMode === 'gemini'
      ? new GeminiAIProvider({ apiKey: apiKey.trim() })
      : fakeProvider
  }

  function setNotice(message: string, error = false) {
    setStatus(message)
    setStatusError(error)
  }

  function loadProject(project: DesktopProject) {
    const recoveredSession = project.session.phase === 'generating'
      ? engine.fail(project.session, {
          code: 'PROVIDER_UNAVAILABLE',
          message: '이전 실행 중 분석이 중단됐습니다. 인터뷰를 다시 시작해 주세요.',
          retryable: true,
        })
      : project.session
    setActiveProjectId(project.id)
    setProjectName(project.name)
    setOriginalPrompt(project.originalPrompt)
    setTargetId(project.targetId)
    setProviderMode(project.providerMode)
    setSession(recoveredSession)
    setResultPrompt(project.resultPrompt)
    setCustomAnswer('')
    setNotice('저장된 프로젝트를 불러왔습니다.')
  }

  async function persistProject(
    nextSession: InterviewSession,
    nextResult = resultPrompt,
    overrides: Partial<Pick<DesktopProject, 'name' | 'targetId' | 'providerMode'>> = {},
  ) {
    const project: DesktopProject = {
      id: nextSession.id,
      name: (overrides.name ?? projectName) || projectNameFromPrompt(nextSession.originalPrompt),
      originalPrompt: nextSession.originalPrompt,
      createdAt: nextSession.createdAt,
      updatedAt: new Date().toISOString(),
      targetId: overrides.targetId ?? targetId,
      providerMode: overrides.providerMode ?? providerMode,
      session: JSON.parse(JSON.stringify(nextSession)) as InterviewSession,
      resultPrompt: nextResult,
    }
    try {
      setProjects(await projectRepository.upsert(project))
    } catch (error) {
      setNotice(`프로젝트 저장에 실패했습니다: ${String(error)}`, true)
    }
  }

  async function readClipboard(fromShortcut = false) {
    const text = (await window.aipiDesktop.readClipboard()).trim()
    if (!text) return setNotice('클립보드에 텍스트가 없습니다.', true)
    setOriginalPrompt(text)
    setActiveProjectId('')
    setProjectName('')
    setSession(null)
    setResultPrompt('')
    setCapturedSourceTarget('')
    setNotice(fromShortcut
      ? '전역 단축키로 클립보드 프롬프트를 캡처했습니다.'
      : '클립보드의 프롬프트를 가져왔습니다.')
  }

  async function startInterview() {
    const prompt = originalPrompt.trim()
    if (!prompt) return setNotice('프롬프트를 입력하세요.', true)
    if (providerMode === 'gemini' && !apiKey.trim()) return setNotice('Gemini API 키를 입력하세요.', true)
    setBusy(true)
    const created = engine.create({
      id: crypto.randomUUID(),
      originalPrompt: prompt,
      sourceTargetId: capturedSourceTarget || 'desktop',
      createdAt: new Date().toISOString(),
    })
    setSession(created)
    setActiveProjectId(created.id)
    const nextName = projectNameFromPrompt(prompt)
    setProjectName(nextName)
    setResultPrompt('')
    await persistProject(created, '', { name: nextName })
    try {
      const generated = await new QuestionGenerationService(provider()).generate(prompt)
      const next = engine.questionsGenerated(created, generated)
      const nextTargetId = generated.recommendation?.targetId ?? targetId
      setSession(next)
      if (generated.recommendation) setTargetId(nextTargetId)
      await persistProject(next, '', { name: nextName, targetId: nextTargetId })
      setNotice(generated.questions.length ? '추가 정보를 선택해 주세요.' : '추가 질문 없이 최적화할 수 있습니다.')
    } catch (error) {
      const failed = engine.fail(created, {
        code: 'PROVIDER_UNAVAILABLE', message: String(error), retryable: true, cause: error,
      })
      setSession(failed)
      await persistProject(failed, '', { name: nextName })
      setNotice(String(error), true)
    } finally {
      setBusy(false)
    }
  }

  function answer(value: string) {
    if (!session || !question || !value.trim()) return
    const next = engine.answer(session, question.id, value.trim())
    setSession(next)
    void persistProject(next)
    if (question.category) {
      void preferenceService.record(question.category, value.trim())
        .then(() => preferenceService.getPreferredValues()).then(setPreferredValues)
    }
    setCustomAnswer('')
  }

  async function optimize() {
    if (!session || session.phase !== 'ready') return
    setBusy(true)
    try {
      const optimized = await new PromptOptimizer(provider(), guidanceProvider).optimize({
        originalPrompt: session.originalPrompt,
        interviewDecisions: collectInterviewDecisions(session.questions, session.answers),
        target,
      })
      setResultPrompt(optimized.prompt)
      await persistProject(session, optimized.prompt)
      setNotice(`${target.displayName}용 최종 프롬프트를 만들었습니다.`)
    } catch (error) {
      const fallback = buildStructuredPrompt({
        originalPrompt: session.originalPrompt,
        interviewDecisions: collectInterviewDecisions(session.questions, session.answers),
        target,
      })
      setResultPrompt(fallback)
      await persistProject(session, fallback)
      setNotice(`AI 재작성에 실패해 답변이 포함된 프롬프트를 표시합니다: ${String(error)}`, true)
    } finally {
      setBusy(false)
    }
  }

  async function copyOutput() {
    if (!output) return
    await window.aipiDesktop.writeClipboard(output)
    setNotice('완성된 프롬프트를 시스템 클립보드에 복사했습니다.')
  }

  async function insertOutputIntoSource() {
    if (!output || !capturedSourceTarget) return
    try {
      const adapter = new DesktopChatTargetAdapter(capturedSourceTarget, {
        isAvailable: () => window.aipiDesktop.platform === 'win32',
        activeTargetId: () => capturedSourceTarget || null,
        readPrompt: () => originalPrompt || null,
        insertPrompt: async (prompt) => {
          const result = await window.aipiDesktop.interceptor.insertPrompt(prompt)
          return { inserted: result.ok, error: result.error }
        },
      })
      await adapter.sendPrompt(output)
      setNotice('완성된 프롬프트를 원래 채팅 입력창에 입력했습니다. 확인한 뒤 직접 전송하세요.')
    } catch (error) {
      setNotice(`원래 채팅창에 입력하지 못했습니다: ${String(error)}`, true)
    }
  }

  async function saveApiKey() {
    const normalized = apiKey.trim()
    if (!normalized) return setNotice('저장할 Gemini API 키를 입력하세요.', true)
    setSavingApiKey(true)
    try {
      await window.aipiDesktop.geminiApiKey.save(normalized)
      setApiKey(normalized)
      setApiKeySaved(true)
      setNotice('Gemini API 키를 Windows 보안 저장소에 암호화해 저장했습니다.')
    } catch (error) {
      setApiKeySaved(false)
      setNotice(`API 키 저장에 실패했습니다: ${String(error)}`, true)
    } finally {
      setSavingApiKey(false)
    }
  }

  async function clearApiKey() {
    if (!window.confirm('이 PC에 저장된 Gemini API 키를 삭제할까요?')) return
    try {
      await window.aipiDesktop.geminiApiKey.clear()
      setApiKey('')
      setApiKeySaved(false)
      setNotice('저장된 Gemini API 키를 삭제했습니다.')
    } catch (error) {
      setNotice(`API 키 삭제에 실패했습니다: ${String(error)}`, true)
    }
  }

  function reset() {
    setActiveProjectId('')
    setProjectName('')
    setOriginalPrompt('')
    setCapturedSourceTarget('')
    setSession(null)
    setResultPrompt('')
    setCustomAnswer('')
    setNotice('새 프롬프트를 입력하세요.')
  }

  async function renameProject() {
    if (!session) return
    const name = projectName.trim() || projectNameFromPrompt(session.originalPrompt)
    setProjectName(name)
    await persistProject(session, resultPrompt, { name })
    setNotice('프로젝트 이름을 저장했습니다.')
  }

  async function deleteProject() {
    if (!activeProjectId || !window.confirm('이 프로젝트 기록을 삭제할까요?')) return
    try {
      const remaining = await projectRepository.remove(activeProjectId)
      setProjects(remaining)
      if (remaining[0]) loadProject(remaining[0])
      else reset()
      setNotice('프로젝트 기록을 삭제했습니다.')
    } catch (error) {
      setNotice(`프로젝트 삭제에 실패했습니다: ${String(error)}`, true)
    }
  }

  async function toggleInterceptor() {
    try {
      const next = await window.aipiDesktop.interceptor.setEnabled(!interceptor.enabled)
      setInterceptor(next)
      setNotice(next.enabled
        ? '데스크톱 AI 앱과 IDE AI 채팅의 프롬프트 가로채기를 켰습니다.'
        : '프롬프트 가로채기를 껐습니다.', !next.enabled && !!next.error)
    } catch (error) {
      setNotice(`프롬프트 가로채기 상태를 바꾸지 못했습니다: ${String(error)}`, true)
    }
  }

  return <main className="shell">
    <header className="hero">
      <div><p className="eyebrow">DESKTOP APP</p><h1>AI Prompt Interviewer</h1>
        <p className="hero-copy">원본 요청을 인터뷰하고 대상 AI에 맞는 완성 프롬프트로 다시 작성합니다.</p></div>
      <div className="desktop-badge"><strong>● Desktop</strong><span>
        {window.aipiDesktop.platform === 'win32' ? 'Windows' : window.aipiDesktop.platform}
        {' · '}{window.aipiDesktop.arch}
      </span></div>
    </header>

    <section className="flow-strip" aria-label="작업 단계">
      {['프롬프트 입력', '추가 질문', '답변 반영', '대상 최적화', '클립보드 복사'].map((step, index) =>
        <span key={step}><b>{index + 1}</b>{step}</span>)}
    </section>

    <section className="project-toolbar" aria-label="저장된 프로젝트">
      <select value={activeProjectId} onChange={(event) => {
        const selected = projects.find((project) => project.id === event.target.value)
        if (selected) loadProject(selected)
      }} disabled={projects.length === 0}>
        {projects.length === 0 && <option value="">저장된 프로젝트 없음</option>}
        {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
      </select>
      <input value={projectName} onChange={(event) => setProjectName(event.target.value)}
        onBlur={() => { if (session) void renameProject() }} placeholder="프로젝트 이름" disabled={!session} />
      <button type="button" onClick={renameProject} disabled={!session}>이름 저장</button>
      <button type="button" className="danger-button" onClick={deleteProject} disabled={!activeProjectId}>삭제</button>
    </section>
    <section className={`shortcut-hint${captureShortcut ? '' : ' shortcut-error'}`}>
      <strong>{captureShortcut ? `전역 캡처 · ${captureShortcut}` : '전역 캡처 단축키 등록 실패'}</strong>
      <span>다른 앱에서 텍스트를 복사한 뒤 단축키를 누르면 새 프롬프트로 가져옵니다.</span>
    </section>
    <section className={`interceptor-bar${interceptor.enabled ? ' interceptor-on' : ''}${interceptor.error ? ' interceptor-error' : ''}`}>
      <div><strong>데스크톱 AI 프롬프트 자동 가로채기</strong>
        <span>ChatGPT·Claude·Codex와 IDE의 AI 채팅 입력란에서만 작동합니다. 브라우저, 검색창, 코드 편집기는 제외됩니다.</span></div>
      <button type="button" onClick={toggleInterceptor} disabled={!interceptor.available}>
        {interceptor.enabled ? '가로채기 끄기' : '가로채기 켜기'}
      </button>
      {interceptor.error && <small>{interceptor.error}</small>}
    </section>

    <section className="workspace">
      <div className="panel interview-panel">
        <div className="panel-heading"><div><span className="step-label">01 / INTERVIEW</span><h2>{phaseLabel(session)}</h2></div>
          <button className="ghost-button" type="button" onClick={reset}>새로 시작</button></div>

        <div className="clipboard-row"><button type="button" onClick={() => readClipboard()}>클립보드에서 가져오기</button></div>
        <label htmlFor="desktop-prompt">원본 프롬프트</label>
        <textarea id="desktop-prompt" value={originalPrompt} onChange={(event) => {
          setOriginalPrompt(event.target.value); setSession(null); setResultPrompt('')
          setCapturedSourceTarget('')
        }} placeholder="AI에게 보낼 요청을 입력하세요." />

        <div className="provider-settings">
          <label htmlFor="provider">재작성 엔진</label>
          <select id="provider" value={providerMode} onChange={(event) => {
            const mode = event.target.value as 'fake' | 'gemini'
            setProviderMode(mode)
            if (session) void persistProject(session, resultPrompt, { providerMode: mode })
          }}>
            <option value="fake">로컬 시뮬레이션</option><option value="gemini">Gemini API</option>
          </select>
          {providerMode === 'gemini' && <><label htmlFor="api-key">Gemini API 키</label>
            <div className="api-key-row">
              <input id="api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => {
                setApiKey(event.target.value)
                setApiKeySaved(false)
              }}
                placeholder="Gemini API 키 입력" />
              <button type="button" className="save-key-button" onClick={saveApiKey} disabled={!apiKey.trim() || savingApiKey}>
                {savingApiKey ? '저장 중…' : apiKeySaved ? '✓ 저장됨' : 'API 키 저장'}
              </button>
              <button type="button" onClick={async () => {
                try {
                  await window.aipiDesktop.openGeminiApiKeyPage()
                  setNotice('기본 브라우저에서 Google AI Studio API 키 페이지를 열었습니다.')
                } catch (error) {
                  setNotice(`API 키 발급 페이지를 열지 못했습니다: ${String(error)}`, true)
                }
              }}>API 키 발급받기 ↗</button>
            </div>
            <div className="api-key-meta">
              <small>{apiKeySaved
                ? '이 PC의 Windows 보안 저장소에 암호화되어 있습니다.'
                : '저장 버튼을 누르기 전까지는 앱 메모리에만 유지됩니다.'}</small>
              {apiKeySaved && <button type="button" className="text-button" onClick={clearApiKey}>저장된 키 삭제</button>}
            </div></>}
        </div>

        {!session && <button className="capture-button" type="button" onClick={startInterview} disabled={busy || !originalPrompt.trim()}>
          인터뷰 시작</button>}
        {session?.phase === 'generating' && <div className="loading-card"><i /> 프롬프트를 분석하고 있습니다.</div>}
        {session?.phase === 'error' && <div className="error-card">{session.error?.message}</div>}

        {session && session.phase !== 'generating' && session.phase !== 'error' && <>
          <label htmlFor="target">최적화 대상</label><select id="target" value={targetId} onChange={(event) => {
            const nextTarget = event.target.value
            setTargetId(nextTarget)
            if (session) void persistProject(session, resultPrompt, { targetId: nextTarget })
          }}>
            {DEFAULT_TARGET_PROFILES.map((item) => <option value={item.id} key={item.id}>{item.displayName}</option>)}
          </select></>}

        {session?.phase === 'interviewing' && question && <section className="question-card">
          <div className="progress-row"><span>INTERVIEW</span><span>{session.currentQuestionIndex + 1} / {session.questions.length}</span></div>
          <h3>{question.text}</h3><div className="option-list">{question.options.map((option) =>
            <button type="button" key={option.value} onClick={() => answer(option.value)}>
              <span>{question.category && preferredValues[question.category] === option.value ? '⭐ ' : ''}{option.label}</span>
              {option.value === question.recommendedValue && <em>AI 추천</em>}</button>)}</div>
          <div className="custom-answer-row"><input value={customAnswer} onChange={(event) => setCustomAnswer(event.target.value)} placeholder="직접 답변" />
            <button type="button" onClick={() => answer(customAnswer)} disabled={!customAnswer.trim()}>확인</button></div>
          <div className="nav-row"><button className="text-button" type="button" disabled={session.currentQuestionIndex === 0}
            onClick={() => { const next = engine.previous(session); setSession(next); void persistProject(next) }}>이전</button>
            <button className="text-button" type="button" onClick={() => {
              const next = engine.skip(session, question.id); setSession(next); void persistProject(next)
            }}>건너뛰기</button></div>
        </section>}

        {session?.phase === 'ready' && <section className="done-card"><span>READY</span>
          <h3>답변 수집 완료</h3><button className="primary-button" type="button" onClick={optimize} disabled={busy}>
            {busy ? '작성 중…' : `${target.displayName}용 최종 프롬프트 만들기`}</button></section>}
        <p className={`desktop-status${statusError ? ' error' : ''}`}>{status}</p>
      </div>

      <div className="result-column"><section className="panel result-panel">
        <div className="panel-heading"><div><span className="step-label">02 / FINAL PROMPT</span><h2>{resultPrompt ? '완성된 프롬프트' : '현재 프롬프트'}</h2></div>
          <div className="output-actions">
            {capturedSourceTarget && <button className="primary-button" type="button" onClick={insertOutputIntoSource} disabled={!output}>
              아래 채팅창에 입력하기</button>}
            <button type="button" onClick={copyOutput} disabled={!output}>클립보드에 복사</button>
          </div></div>
        <pre>{output || '왼쪽에서 프롬프트를 입력하세요.'}</pre>
      </section>
      <section className="panel guidance-panel"><span className="step-label">03 / TARGET</span><h2>{target.displayName}</h2>
        <p className="status-ok">{target.displayName} 전용 규칙으로 최종 프롬프트를 구성합니다.</p></section>
      <section className="validation-strip"><span><i /> Desktop Window</span><span><i /> Core 공유</span><span><i /> Clipboard 연결</span></section>
      </div>
    </section>
  </main>
}
