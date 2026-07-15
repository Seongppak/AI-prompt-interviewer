import { useEffect, useState } from 'react'
import { composePrompt } from './composePrompt'
import { insertIntoChatGpt, type InsertResult } from './insertIntoChatGpt'
import { DebugLogs } from './DebugLogs'
import { Settings } from './Settings'
import {
  getActiveProjectId,
  getProjects,
  setActiveProjectId,
  updateProject,
  type Project,
} from '../shared/project'
import './App.css'

const STATUS_MESSAGE: Record<InsertResult, string> = {
  inserted: '✅ ChatGPT 입력창에 삽입했어요',
  no_tab: '⚠️ 열려 있는 ChatGPT 탭을 찾지 못했어요',
  failed: '⚠️ 입력창을 찾지 못했어요. ChatGPT 페이지를 새로고침해보세요',
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
  const [status, setStatus] = useState<InsertResult | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [customText, setCustomText] = useState('')

  useEffect(() => {
    getProjects().then(setProjects)
    getActiveProjectId().then(setActiveId)

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return
      if (changes['projects']) {
        setProjects((changes['projects'].newValue ?? []) as Project[])
      }
      if (changes['active_project_id']) {
        setActiveId((changes['active_project_id'].newValue ?? '') as string)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
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
  useEffect(() => {
    setCustomMode(false)
    setCustomText('')
  }, [activeId, stepIndex])

  function handleAnswer(value: string) {
    if (!activeProject || !currentQuestion) return
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

  async function handleInsert() {
    if (!activeProject) return
    setStatus(null)
    try {
      const result = await insertIntoChatGpt(
        composePrompt(activeProject.originalQuestion, questions, answers),
      )
      setStatus(result)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <main className="interview">
      <h1>AI Prompt Interviewer</h1>

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

      {!activeProject && (
        <section className="placeholder">
          <p>ChatGPT에서 질문을 입력하면 여기서 인터뷰가 시작돼요.</p>
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
            {currentQuestion.options.map((option) => (
              <button key={option.value} type="button" onClick={() => handleAnswer(option.value)}>
                {option.label}
              </button>
            ))}
            <button type="button" onClick={() => setCustomMode(true)}>
              기타 (직접 입력)
            </button>
          </div>

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
          <button type="button" onClick={handleInsert}>
            ChatGPT에 삽입
          </button>
          {questions.length > 0 && (
            <button type="button" onClick={handleRestart}>
              다시 시작
            </button>
          )}
          {status && <p className="status-message">{STATUS_MESSAGE[status]}</p>}
        </section>
      )}

      <Settings />
      <DebugLogs />
    </main>
  )
}

export default App
