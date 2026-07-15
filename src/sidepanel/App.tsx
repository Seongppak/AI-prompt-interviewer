import { useState } from 'react'
import { mockQuestions } from './data/mockQuestions'
import { composePrompt } from './composePrompt'
import { insertIntoChatGpt, type InsertResult } from './insertIntoChatGpt'
import { DebugLogs } from './DebugLogs'
import './App.css'

const STATUS_MESSAGE: Record<InsertResult, string> = {
  inserted: '✅ ChatGPT 입력창에 삽입했어요',
  no_tab: '⚠️ 열려 있는 ChatGPT 탭을 찾지 못했어요',
  failed: '⚠️ 입력창을 찾지 못했어요. ChatGPT 페이지를 새로고침해보세요',
}

function App() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<InsertResult | null>(null)

  const isDone = stepIndex >= mockQuestions.length
  const currentQuestion = mockQuestions[stepIndex]

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
      const result = await insertIntoChatGpt(composePrompt(mockQuestions, answers))
      setStatus(result)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <main className="interview">
      <h1>AI Prompt Interviewer</h1>

      {!isDone && currentQuestion && (
        <section className="question">
          <p className="progress">
            {stepIndex + 1} / {mockQuestions.length}
          </p>
          <p className="question-text">{currentQuestion.text}</p>
          <div className="options">
            {currentQuestion.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleAnswer(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {isDone && (
        <section className="result">
          <p className="result-label">완성된 프롬프트</p>
          <pre className="prompt-preview">
            {composePrompt(mockQuestions, answers)}
          </pre>
          <button type="button" onClick={handleInsert}>
            ChatGPT에 삽입
          </button>
          <button type="button" onClick={handleRestart}>
            다시 시작
          </button>
          {status && <p className="status-message">{STATUS_MESSAGE[status]}</p>}
        </section>
      )}

      <DebugLogs />
    </main>
  )
}

export default App
