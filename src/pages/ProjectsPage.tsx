import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRepos, createRepo, type GHUser, type GHRepo } from '../api/github'

interface Props {
  user: GHUser
}

export default function ProjectsPage({ user }: Props) {
  const [repos, setRepos] = useState<GHRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    listRepos(user.login)
      .then(setRepos)
      .finally(() => setLoading(false))
  }, [user.login])

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1>项目列表</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ width: 220 }}
            placeholder="搜索项目..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="primary" onClick={() => setShowModal(true)}>+ 新建项目</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 24, color: 'var(--text2)' }}>
          <span className="spinner" /> 加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">暂无项目，点击「新建项目」创建</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(repo => (
            <div
              key={repo.id}
              className="list-item"
              onClick={() => navigate(`/projects/${user.login}/${repo.name}`)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {repo.private ? '🔒 ' : '📁 '}{repo.name}
                </div>
                {repo.description && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repo.description}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                {repo.open_issues_count} 个任务
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                {new Date(repo.updated_at).toLocaleDateString('zh-CN')}
              </div>
              <span style={{ color: 'var(--text2)' }}>›</span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CreateRepoModal
          onClose={() => setShowModal(false)}
          onCreate={repo => {
            setRepos(prev => [repo, ...prev])
            setShowModal(false)
            navigate(`/projects/${user.login}/${repo.name}`)
          }}
        />
      )}
    </div>
  )
}

function CreateRepoModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: GHRepo) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const repo = await createRepo(name.trim(), desc.trim(), isPrivate)
      onCreate(repo)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>新建项目</h2>
        <div className="form-group">
          <label>仓库名称 *</label>
          <input autoFocus placeholder="my-project" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>描述（可选）</label>
          <input placeholder="项目描述..." value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="private"
            style={{ width: 'auto' }}
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
          />
          <label htmlFor="private" style={{ cursor: 'pointer' }}>私有仓库</label>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
