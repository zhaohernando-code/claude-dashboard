import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listRepos, listIssues, createRepo, getIssueStatus, type GHUser, type GHRepo } from '../api/github'
import { useToast } from '../components/Toast'

interface Props {
  user: GHUser
}

interface RepoStats {
  pending: number
  running: number
  completed: number
  failed: number
}

export default function ProjectsPage({ user }: Props) {
  const [repos, setRepos] = useState<GHRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [repoStats, setRepoStats] = useState<Record<number, RepoStats>>({})
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function loadRepos(showMsg = false) {
    try {
      const data = await listRepos(user.login)
      setRepos(data)
      if (showMsg) showToast('已刷新', 'success')
      // 加载完后异步拉取各项目任务统计
      loadAllStats(data)
    } catch {
      showToast('加载失败', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadAllStats(repoList: GHRepo[]) {
    // 分批并发，每批 3 个，避免触发 rate limit
    for (let i = 0; i < repoList.length; i += 3) {
      const batch = repoList.slice(i, i + 3)
      await Promise.all(batch.map(async (repo) => {
        try {
          const issues = await listIssues(user.login, repo.name, 'all')
          const counts: RepoStats = { pending: 0, running: 0, completed: 0, failed: 0 }
          for (const issue of issues) {
            const s = getIssueStatus(issue)
            if (s) {
              const key = s.replace('status:', '') as keyof RepoStats
              counts[key]++
            }
          }
          setRepoStats(prev => ({ ...prev, [repo.id]: counts }))
        } catch { /* ignore */ }
      }))
    }
  }

  useEffect(() => { loadRepos() }, [user.login])

  async function handleRefresh() {
    setRefreshing(true)
    await loadRepos(true)
  }

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1>项目列表</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            style={{ width: 180 }}
            placeholder="搜索项目..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {refreshing ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 刷新中</> : '↻ 刷新'}
          </button>
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
          {filtered.map(repo => {
            const stats = repoStats[repo.id]
            return (
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
                {/* 任务状态统计 */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  {stats ? (
                    <>
                      {stats.running > 0 && <span className="badge running">{stats.running} 运行</span>}
                      {stats.pending > 0 && <span className="badge pending">{stats.pending} 待执行</span>}
                      {stats.failed > 0  && <span className="badge failed">{stats.failed} 失败</span>}
                      {stats.running === 0 && stats.pending === 0 && stats.failed === 0 && stats.completed > 0 && (
                        <span className="badge completed">{stats.completed} 完成</span>
                      )}
                      {stats.running === 0 && stats.pending === 0 && stats.failed === 0 && stats.completed === 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text2)' }}>无任务</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                      {repo.open_issues_count > 0 ? `${repo.open_issues_count} 个任务` : '无任务'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {new Date(repo.updated_at).toLocaleDateString('zh-CN')}
                </div>
                <span style={{ color: 'var(--text2)' }}>›</span>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <CreateRepoModal
          onClose={() => setShowModal(false)}
          onCreate={repo => {
            setRepos(prev => [repo, ...prev])
            setShowModal(false)
            showToast('项目创建成功', 'success')
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
