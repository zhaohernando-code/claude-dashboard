import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { getMe, getToken, clearToken, type GHUser } from './api/github'
import { ToastProvider } from './components/Toast'
import LoginPage from './pages/LoginPage'
import ProjectsPage from './pages/ProjectsPage'
import TasksPage from './pages/TasksPage'
import TaskDetailPage from './pages/TaskDetailPage'
import UsagePage from './pages/UsagePage'

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

  function handleLogout() {
    clearToken()
    setUser(null)
  }

  return (
    <ToastProvider>
      <BrowserRouter basename="/claude-dashboard">
        <MobileHeader user={user} onLogout={handleLogout} />
        <div className="layout">
          <aside className="sidebar">
            <div className="logo">🤖 Claude 中台</div>
            <nav>
              <NavLink to="/projects" className={({ isActive }) => isActive ? 'active' : ''}>
                📁 项目列表
              </NavLink>
              <NavLink to="/usage" className={({ isActive }) => isActive ? 'active' : ''}>
                📊 用量统计
              </NavLink>
            </nav>
            <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border)', position: 'absolute', bottom: 0, width: '100%' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                {user.login}
              </div>
              <button onClick={handleLogout} style={{ width: '100%', fontSize: 12 }}>
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
              <Route path="/usage" element={<UsagePage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}

function MobileHeader({ user, onLogout }: { user: GHUser; onLogout: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="mobile-header">
      <div className="mobile-header-logo" onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>
        🤖 Claude 中台
      </div>
      <div className="mobile-header-right">
        <NavLink to="/projects" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>项目</NavLink>
        <NavLink to="/usage" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>用量</NavLink>
        <span className="mobile-header-user">{user.login}</span>
        <button onClick={onLogout} style={{ fontSize: 12, padding: '4px 10px' }}>退出</button>
      </div>
    </div>
  )
}
