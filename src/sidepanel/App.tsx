import { useState } from 'react'
import { mockQuestions } from './data/mockQuestions'
import { composePrompt } from './composePrompt'
import './App.css'

function App() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const isDone = stepIndex >= mockQuestions.length
  const currentQuestion = mockQuestions[stepIndex]

  function handleAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
    setStepIndex((prev) => prev + 1)
  }

  function handleRestart() {
    setStepIndex(0)
    setAnswers({})
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
          <button type="button" onClick={handleRestart}>
            다시 시작
          </button>
        </section>
      )}
    </main>
  )
}

export default App
