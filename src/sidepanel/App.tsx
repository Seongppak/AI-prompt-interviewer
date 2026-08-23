import { useEffect, useState } from 'react'
import { composePrompt } from './composePrompt'
import { insertIntoAiTab, openAndInsertPrompt, type InsertResult } from './insertIntoAiTab'
import { getBestEffortPrompt } from './optimizePrompt'
import { sendToClaudeCode, type HandoffResult } from './sendToClaudeCode'
import { DebugLogs } from './DebugLogs'
import { Settings } from './Settings'
import {
  getActiveProjectId,
  getProjects,
  setActiveProjectId,
  updateProject,
  type Project,
} from '../shared/project'
import { getPreferredValues, recordPreference } from '../shared/preferences'
import { getExtensionEnabled, getTheme, setExtensionEnabled, type Theme } from '../shared/settings'
import { subscribeStored } from '../shared/storage'
import { findSiteByDisplayName, getBaseUrl, getSiteConfig } from '../shared/sites'
import './App.css'

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.dataset.theme = theme
  }
}

function siteDisplayName(hostname: string | undefined): string {
  return (hostname && getSiteConfig(hostname)?.displayName) || '채팅창'
}

function statusMessage(result: InsertResult, displayName: string): string {
  switch (result) {
    case 'inserted':
      return `✅ ${displayName}에 삽입했어요`
    case 'no_tab':
      return `⚠️ 열려 있는 ${displayName} 탭을 찾지 못했어요`
    case 'failed':
      return '⚠️ 입력창을 찾지 못했어요. 페이지를 새로고침해보세요'
  }
}

function formatProjectLabel(project: Project): string {
  const date = new Date(project.createdAt)
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`
  const summary =
    project.originalQuestion.length > 24
      ? `${project.originalQuestion.slice(0, 24)}…`
      : project.originalQuestion
  return `${summary} · ${dateLabel}`
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState('')
  const [status, setStatus] = useState<{ result: InsertResult; siteName: string } | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [customText, setCustomText] = useState('')
  const [preferredValues, setPreferredValues] = useState<Record<string, string>>({})
  const [enabled, setEnabledState] = useState(true)
  const [isInserting, setIsInserting] = useState(false)
  const [handoff, setHandoff] = useState<HandoffResult | null>(null)

  useEffect(() => {
    getProjects().then(setProjects)
    getActiveProjectId().then(setActiveId)
    getPreferredValues().then(setPreferredValues)
    getExtensionEnabled().then(setEnabledState)
    getTheme().then(applyTheme)

    // 키마다 사는 area가 다르므로(local/sync) 각자 subscribeStored로 구독한다.
    // 예전처럼 area를 'local'로 하드코딩하면 sync로 옮긴 키의 갱신을 조용히 놓친다.
    const unsubscribes = [
      subscribeStored('projects', (value) => setProjects((value ?? []) as Project[])),
      subscribeStored('active_project_id', (value) => setActiveId((value ?? '') as string)),
      subscribeStored('preferences', () => getPreferredValues().then(setPreferredValues)),
      subscribeStored('extension_enabled', (value) => setEnabledState(value !== false)),
      subscribeStored('theme', (value) => applyTheme((value ?? 'system') as Theme)),
    ]
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [])

  useEffect(() => {
    setStatus(null)
  }, [activeId])

  const activeProject = projects.find((project) => project.id === activeId) ?? null
  const questions = activeProject?.questions ?? []
  const stepIndex = activeProject?.stepIndex ?? 0
  const answers = activeProject?.answers ?? {}
  const isInterviewDone = stepIndex >= questions.length
  const currentQuestion = questions[stepIndex]

  // 질문이 바뀌면 이전 질문에서 열어둔 기타 입력 상태를 초기화한다.
  // 답변이 추가되면 프롬프트 내용도 달라지므로 "복사됨" 표시도 함께 되돌린다.
  useEffect(() => {
    setCustomMode(false)
    setCustomText('')
    setHandoff(null)
  }, [activeId, stepIndex])

  function handleAnswer(value: string) {
    if (!activeProject || !currentQuestion) return
    if (currentQuestion.category) {
      recordPreference(currentQuestion.category, value)
    }
    updateProject(activeProject.id, {
      answers: { ...answers, [currentQuestion.id]: value },
      stepIndex: stepIndex + 1,
    })
  }

  function handleCustomSubmit() {
    const value = customText.trim()
    if (!value) return
    handleAnswer(value)
  }

  function handleSkip() {
    if (!activeProject || !currentQuestion) return
    const nextAnswers = { ...answers }
    delete nextAnswers[currentQuestion.id]
    updateProject(activeProject.id, { answers: nextAnswers, stepIndex: stepIndex + 1 })
  }

  function handleBack() {
    if (!activeProject || stepIndex === 0) return
    updateProject(activeProject.id, { stepIndex: stepIndex - 1 })
  }

  function handleRestart() {
    if (!activeProject) return
    updateProject(activeProject.id, { answers: {}, stepIndex: 0 })
    setStatus(null)
  }

  async function handleClosePanel() {
    // 가로채기까지 꺼야 창을 닫은 뒤 Enter를 눌러도 패널이 다시 튀어나오지 않는다.
    await setExtensionEnabled(false)
    window.close()
  }

  async function handleInsert() {
    if (!activeProject) return
    setStatus(null)
    setIsInserting(true)
    try {
      const prompt = await getBestEffortPrompt({
        originalPrompt: activeProject.originalQuestion,
        questions,
        answers,
      }, activeSiteName)
      const result = await insertIntoAiTab(prompt, activeProject.sourceHostname)
      setStatus({ result, siteName: activeSiteName })
    } catch {
      setStatus({ result: 'failed', siteName: activeSiteName })
    } finally {
      setIsInserting(false)
    }
  }

  // Claude Code로 넘길 때는 Gemini 최적화를 거치지 않는다 — 저쪽에서 더 좋은 모델이
  // 코드베이스까지 읽고 다시 다듬으므로, 여기서 미리 손대면 재작업만 늘어난다.
  // 인터뷰 중에 눌러도 composePrompt가 답변된 질문만 골라내서 그 시점까지의 프롬프트가 나온다.
  async function handleSendToClaudeCode() {
    if (!activeProject) return
    const prompt = composePrompt(activeProject.originalQuestion, questions, answers)
    setHandoff(await sendToClaudeCode(prompt, activeProject.sourceHostname))
  }

  const activeSiteName = siteDisplayName(activeProject?.sourceHostname)

  const recommendedSite = activeProject?.recommendedSite?.trim()
  const showSiteRecommendation =
    !!recommendedSite && recommendedSite.toLowerCase() !== activeSiteName.toLowerCase()
  const recommendedSiteConfig = recommendedSite ? findSiteByDisplayName(recommendedSite) : undefined

  async function handleOpenRecommendedSite() {
    if (!recommendedSiteConfig || !activeProject) return
    const url = getBaseUrl(recommendedSiteConfig)

    // 인터뷰가 끝나 완성된 프롬프트가 있으면, 새 탭을 열면서 바로 그 프롬프트를 삽입한다.
    if (isInterviewDone) {
      setStatus(null)
      setIsInserting(true)
      try {
        const prompt = await getBestEffortPrompt({
          originalPrompt: activeProject.originalQuestion,
          questions,
          answers,
        }, recommendedSite!)
        const result = await openAndInsertPrompt(url, prompt)
        setStatus({ result, siteName: recommendedSite! })
      } catch {
        setStatus({ result: 'failed', siteName: recommendedSite! })
      } finally {
        setIsInserting(false)
      }
    } else {
      chrome.tabs.create({ url })
    }
  }

  return (
    <main className="interview">
      <div className="header-row">
        <h1>AI Prompt Interviewer</h1>
        <div className="header-controls">
          <button
            type="button"
            className="intercept-toggle"
            onClick={() => setExtensionEnabled(!enabled)}
            title={enabled ? '가로채기 끄기' : '가로채기 켜기'}
          >
            {enabled ? '✓' : '−'}
          </button>
          <button
            type="button"
            className="close-panel"
            onClick={handleClosePanel}
            title="창 닫기"
          >
            ✕
          </button>
        </div>
      </div>

      {!enabled && (
        <p className="disabled-notice">⏸ 확장 기능이 꺼져 있어요. 질문을 가로채지 않습니다.</p>
      )}

      {projects.length > 0 && (
        <select
          className="project-select"
          value={activeId}
          onChange={(e) => setActiveProjectId(e.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {formatProjectLabel(project)}
            </option>
          ))}
        </select>
      )}

      {showSiteRecommendation && (
        <section className="site-recommendation">
          <p>
            💡 이 작업은 <strong>{recommendedSite}</strong>가 더 적합할 수 있어요
            {activeProject?.recommendedSiteReason ? `: ${activeProject.recommendedSiteReason}` : ''}
          </p>
          {recommendedSiteConfig && (
            <button type="button" onClick={handleOpenRecommendedSite} disabled={isInserting}>
              {isInserting
                ? '최적화 중...'
                : isInterviewDone
                  ? `${recommendedSite}에 삽입`
                  : `${recommendedSite}에서 새로 시작`}
            </button>
          )}
        </section>
      )}

      {!activeProject && (
        <section className="placeholder">
          <p>AI 사이트에서 질문을 입력하면 여기서 인터뷰가 시작돼요.</p>
        </section>
      )}

      {activeProject && activeProject.status === 'loading' && (
        <section className="placeholder">
          <p>질문을 분석하고 있어요...</p>
        </section>
      )}

      {activeProject && activeProject.status === 'error' && (
        <section className="placeholder">
          <p>⚠️ {activeProject.error ?? '질문을 분석하지 못했어요'}</p>
        </section>
      )}

      {activeProject && activeProject.status === 'interviewing' && !isInterviewDone && currentQuestion && (
        <section className="question">
          <p className="progress">
            {stepIndex + 1} / {questions.length}
          </p>
          <p className="question-text">{currentQuestion.text}</p>
          <div className="options">
            {currentQuestion.options.map((option) => {
              const isPreferred =
                !!currentQuestion.category &&
                preferredValues[currentQuestion.category] === option.value
              const isAiRecommended = currentQuestion.recommendedValue === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={isPreferred ? 'option-recommended' : undefined}
                  onClick={() => handleAnswer(option.value)}
                >
                  {isPreferred ? '⭐ ' : ''}
                  {isAiRecommended ? '🤖 ' : ''}
                  {option.label}
                </button>
              )
            })}
            <button type="button" onClick={() => setCustomMode(true)}>
              기타 (직접 입력)
            </button>
          </div>

          {currentQuestion.recommendedReason && (
            <p className="ai-recommend-reason">🤖 AI 추천 이유: {currentQuestion.recommendedReason}</p>
          )}

          {customMode && (
            <div className="custom-answer">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="답변을 입력하세요"
                autoFocus
              />
              <button type="button" onClick={handleCustomSubmit} disabled={!customText.trim()}>
                확인
              </button>
            </div>
          )}

          <div className="question-nav">
            {stepIndex > 0 && (
              <button type="button" onClick={handleBack}>
                ← 이전
              </button>
            )}
            <button type="button" onClick={handleSkip}>
              건너뛰기
            </button>
          </div>
        </section>
      )}

      {activeProject && activeProject.status === 'interviewing' && isInterviewDone && (
        <section className="result">
          <p className="result-label">완성된 프롬프트</p>
          <pre className="prompt-preview">
            {composePrompt(activeProject.originalQuestion, questions, answers)}
          </pre>
          <button type="button" onClick={handleInsert} disabled={isInserting}>
            {isInserting ? '최적화 중...' : `${activeSiteName}에 삽입`}
          </button>
          {questions.length > 0 && (
            <button type="button" onClick={handleRestart} disabled={isInserting}>
              다시 시작
            </button>
          )}
        </section>
      )}

      {status && (
        <p className="status-message">{statusMessage(status.result, status.siteName)}</p>
      )}

      {activeProject && activeProject.status === 'interviewing' && (
        <section className="handoff">
          <button type="button" onClick={handleSendToClaudeCode}>
            {handoff ? '✅ 보냈어요 — Claude Code에서 /inbox' : '📤 Claude Code로 보내기'}
          </button>
          {handoff && !handoff.file && (
            <p className="handoff-note">
              ⚠️ 파일 저장에 실패해 클립보드로만 보냈어요. 다른 걸 복사하기 전에 /inbox를 실행해주세요.
            </p>
          )}
        </section>
      )}

      <Settings />
      <DebugLogs />
    </main>
  )
}

export default App
