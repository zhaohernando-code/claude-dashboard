import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { getMe, getToken, clearToken, type GHUser } from './api/github'
import LoginPage from './pages/LoginPage'
import ProjectsPage from './pages/ProjectsPage'
import TasksPage from './pages/TasksPage'
import TaskDetailPage from './pages/TaskDetailPage'

export default function App() {
  const [user, setUser] = useState<GHUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    getMe()
      .then(u => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 32 }}>加载中...</div>

  if (!user) return <LoginPage onLogin={setUser} />

  return (
    <BrowserRouter basename="/claude-dashboard">
      <div className="layout">
        <aside className="sidebar">
          <div className="logo">🤖 Claude 中台</div>
          <nav>
            <NavLink to="/projects" className={({ isActive }) => isActive ? 'active' : ''}>
              📁 项目列表
            </NavLink>
          </nav>
          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border)', position: 'absolute', bottom: 0, width: '100%' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
              {user.login}
            </div>
            <button onClick={() => { clearToken(); setUser(null) }} style={{ width: '100%', fontSize: 12 }}>
              退出登录
            </button>
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage user={user} />} />
            <Route path="/projects/:owner/:repo" element={<TasksPage />} />
            <Route path="/projects/:owner/:repo/issues/:number" element={<TaskDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
