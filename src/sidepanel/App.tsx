import { useEffect, useState } from 'react'
import { composePrompt } from './composePrompt'
import { insertIntoChatGpt, type InsertResult } from './insertIntoChatGpt'
import { DebugLogs } from './DebugLogs'
import { Settings } from './Settings'
import { getPendingQuestion } from '../shared/pendingQuestion'
import { getDynamicQuestions, type DynamicQuestionsState } from '../shared/dynamicQuestions'
import './App.css'

const STATUS_MESSAGE: Record<InsertResult, string> = {
  inserted: '✅ ChatGPT 입력창에 삽입했어요',
  no_tab: '⚠️ 열려 있는 ChatGPT 탭을 찾지 못했어요',
  failed: '⚠️ 입력창을 찾지 못했어요. ChatGPT 페이지를 새로고침해보세요',
}

function App() {
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [dynamicState, setDynamicState] = useState<DynamicQuestionsState | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<InsertResult | null>(null)

  useEffect(() => {
    getPendingQuestion().then(setPendingQuestion)
    getDynamicQuestions().then(setDynamicState)

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return
      if (changes['pending_question']) {
        setPendingQuestion((changes['pending_question'].newValue ?? '') as string)
      }
      if (changes['dynamic_questions']) {
        setDynamicState(
          (changes['dynamic_questions'].newValue ?? null) as DynamicQuestionsState | null,
        )
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  // 새 질문이 들어오면 이전 인터뷰 진행 상태를 초기화한다.
  useEffect(() => {
    setStepIndex(0)
    setAnswers({})
    setStatus(null)
  }, [pendingQuestion])

  const questions = dynamicState?.status === 'ready' ? dynamicState.questions : []
  const isInterviewDone = stepIndex >= questions.length
  const currentQuestion = questions[stepIndex]

  function handleAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
    setStepIndex((prev) => prev + 1)
  }

  function handleRestart() {
    setStepIndex(0)
    setAnswers({})
    setStatus(null)
  }

  async function handleInsert() {
    setStatus(null)
    try {
      const result = await insertIntoChatGpt(composePrompt(pendingQuestion, questions, answers))
      setStatus(result)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <main className="interview">
      <h1>AI Prompt Interviewer</h1>

      {!pendingQuestion && (
        <section className="placeholder">
          <p>ChatGPT에서 질문을 입력하면 여기서 인터뷰가 시작돼요.</p>
        </section>
      )}

      {pendingQuestion && (!dynamicState || dynamicState.status === 'loading') && (
        <section className="placeholder">
          <p>질문을 분석하고 있어요...</p>
        </section>
      )}

      {pendingQuestion && dynamicState?.status === 'error' && (
        <section className="placeholder">
          <p>⚠️ {dynamicState.error ?? '질문을 분석하지 못했어요'}</p>
        </section>
      )}

      {pendingQuestion && dynamicState?.status === 'ready' && !isInterviewDone && currentQuestion && (
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
          </div>
        </section>
      )}

      {pendingQuestion && dynamicState?.status === 'ready' && isInterviewDone && (
        <section className="result">
          <p className="result-label">완성된 프롬프트</p>
          <pre className="prompt-preview">{composePrompt(pendingQuestion, questions, answers)}</pre>
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
