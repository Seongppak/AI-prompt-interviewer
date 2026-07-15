import { useEffect, useState } from 'react'
import { clearApiKey, getApiKey, getTheme, setApiKey, setTheme, type Theme } from '../shared/settings'

const THEME_LABELS: Record<Theme, string> = {
  system: '시스템 설정',
  light: '라이트',
  dark: '다크',
}

export function Settings() {
  const [visible, setVisible] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [status, setStatus] = useState('')
  const [theme, setThemeState] = useState<Theme>('system')

  async function refresh() {
    const existing = await getApiKey()
    setHasKey(existing.length > 0)
    setKeyInput('')
    setThemeState(await getTheme())
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggle() {
    const next = !visible
    setVisible(next)
    if (next) await refresh()
  }

  async function handleSave() {
    if (!keyInput.trim()) return
    await setApiKey(keyInput.trim())
    setStatus('저장했어요')
    await refresh()
  }

  async function handleClear() {
    await clearApiKey()
    setStatus('삭제했어요')
    await refresh()
  }

  async function handleThemeChange(next: Theme) {
    setThemeState(next)
    await setTheme(next)
  }

  return (
    <section className="settings">
      <button type="button" onClick={toggle}>
        {visible ? '설정 숨기기' : hasKey ? '⚙️ 설정 (API 키 등록됨)' : '⚙️ 설정 (API 키 필요)'}
      </button>

      {visible && (
        <div className="settings-body">
          <span className="settings-label">테마</span>
          <div className="theme-options">
            {(Object.keys(THEME_LABELS) as Theme[]).map((option) => (
              <button
                key={option}
                type="button"
                className={theme === option ? 'theme-option-active' : undefined}
                onClick={() => handleThemeChange(option)}
              >
                {THEME_LABELS[option]}
              </button>
            ))}
          </div>

          <label className="settings-label" htmlFor="api-key-input">
            Gemini API 키
          </label>
          <input
            id="api-key-input"
            type="password"
            placeholder={hasKey ? '••••••••••••••••' : 'AIza...'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <div className="settings-actions">
            <button type="button" onClick={handleSave} disabled={!keyInput.trim()}>
              저장
            </button>
            <button type="button" onClick={handleClear} disabled={!hasKey}>
              삭제
            </button>
            <a
              className="settings-key-link"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              API 키 발급받기 ↗
            </a>
          </div>
          {status && <p className="status-message">{status}</p>}
        </div>
      )}
    </section>
  )
}
