import { useState } from 'react'
import { getMe, setToken, type GHUser } from '../api/github'

interface Props {
  onLogin: (user: GHUser) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [pat, setPat] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!pat.trim()) return
    setLoading(true)
    setError('')
    try {
      setToken(pat.trim())
      const user = await getMe()
      onLogin(user)
    } catch {
      setError('Token 无效或网络错误，请检查后重试')
      setToken('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box card">
        <h1>🤖 Claude 任务中台</h1>
        <p style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 13 }}>
          请输入 GitHub Personal Access Token（需要 <code>repo</code> 权限）
        </p>
        <div className="form-group">
          <label>GitHub PAT</label>
          <input
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            value={pat}
            onChange={e => setPat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button
          className="primary"
          style={{ width: '100%', marginTop: 12, padding: '8px 0' }}
          onClick={handleLogin}
          disabled={loading || !pat.trim()}
        >
          {loading ? '验证中...' : '登录'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 12 }}>
          Token 仅存于本地浏览器，不会上传到任何服务器
        </p>
      </div>
    </div>
  )
}
