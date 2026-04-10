import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  listIssues, createIssue, retryIssue, setIssueLabels,
  getIssueStatus, STATUS_LABELS, type GHIssue
} from '../api/github'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'

export default function TasksPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [issues, setIssues] = useState<GHIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)

  const loadIssues = useCallback(async () => {
    if (!owner || !repo) return
    const data = await listIssues(owner, repo, 'all')
    setIssues(data)
    setLoading(false)
  }, [owner, repo])

  useEffect(() => { loadIssues() }, [loadIssues])

  // 30s 自动刷新
  useEffect(() => {
    const t = setInterval(loadIssues, 30000)
    return () => clearInterval(t)
  }, [loadIssues])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await loadIssues()
      showToast('已刷新', 'success')
    } catch {
      showToast('刷新失败', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = issues.filter(issue => {
    if (filter === 'all') return true
    return getIssueStatus(issue) === filter
  })

  const counts = STATUS_LABELS.reduce((acc, label) => {
    acc[label] = issues.filter(i => getIssueStatus(i) === label).length
    return acc
  }, {} as Record<string, number>)

  async function handleRetry(e: React.MouseEvent, issue: GHIssue) {
    e.stopPropagation()
    if (!owner || !repo) return
    try {
      await retryIssue(owner, repo, issue)
      await loadIssues()
      showToast('已重新提交', 'success')
    } catch {
      showToast('操作失败', 'error')
    }
  }

  async function handleCancel(e: React.MouseEvent, issue: GHIssue) {
    e.stopPropagation()
    if (!owner || !repo) return
    try {
      const otherLabels = issue.labels
        .map(l => l.name)
        .filter(n => !STATUS_LABELS.includes(n as typeof STATUS_LABELS[number]))
      await setIssueLabels(owner, repo, issue.number, [...otherLabels, 'status:failed'])
      await loadIssues()
      showToast('已取消', 'info')
    } catch {
      showToast('操作失败', 'error')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/projects')}
            >项目列表</span> › {repo}
          </div>
          <h1>{repo}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {refreshing
              ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 刷新中</>
              : '↻ 刷新'}
          </button>
          <button className="primary" onClick={() => setShowModal(true)}>+ 新建任务</button>
        </div>
      </div>

      {/* 状态筛选 */}
      <div className="filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter('all')}
          style={{ opacity: filter === 'all' ? 1 : 0.6, whiteSpace: 'nowrap' }}
        >全部 ({issues.length})</button>
        {STATUS_LABELS.map(label => {
          const key = label.replace('status:', '') as 'pending' | 'running' | 'completed' | 'failed'
          return (
            <button
              key={label}
              onClick={() => setFilter(label)}
              style={{ opacity: filter === label ? 1 : 0.6, whiteSpace: 'nowrap' }}
            >
              <StatusBadge status={key} /> {counts[label] || 0}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 24, color: 'var(--text2)' }}>
          <span className="spinner" /> 加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">暂无任务</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(issue => {
            const status = getIssueStatus(issue)
            const statusKey = status?.replace('status:', '') as 'pending' | 'running' | 'completed' | 'failed' | undefined
            return (
              <div
                key={issue.id}
                className="list-item"
                onClick={() => navigate(`/projects/${owner}/${repo}/issues/${issue.number}`)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{issue.number} {issue.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {new Date(issue.created_at).toLocaleString('zh-CN')} · {issue.comments} 条评论
                  </div>
                </div>
                {statusKey && <StatusBadge status={statusKey} />}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(status === 'status:failed' || status === 'status:completed') && (
                    <button
                      onClick={e => handleRetry(e, issue)}
                      style={{ fontSize: 12, padding: '2px 8px' }}
                    >重试</button>
                  )}
                  {status === 'status:pending' && (
                    <button
                      onClick={e => handleCancel(e, issue)}
                      style={{ fontSize: 12, padding: '2px 8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >取消</button>
                  )}
                </div>
                <span style={{ color: 'var(--text2)' }}>›</span>
              </div>
            )
          })}
        </div>
      )}

      {showModal && owner && repo && (
        <CreateTaskModal
          owner={owner}
          repo={repo}
          onClose={() => setShowModal(false)}
          onCreate={() => {
            setShowModal(false)
            loadIssues()
            showToast('任务已创建，等待执行', 'success')
          }}
        />
      )}
    </div>
  )
}

function CreateTaskModal({
  owner, repo, onClose, onCreate
}: { owner: string; repo: string; onClose: () => void; onCreate: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      await createIssue(owner, repo, title.trim(), body.trim())
      onCreate()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>新建任务</h2>
        <div className="form-group">
          <label>任务标题 *</label>
          <input
            autoFocus
            placeholder="描述你想让 Claude 完成的任务..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>详细描述（可选）</label>
          <textarea
            placeholder="补充详细需求、约束条件、参考资料等..."
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ minHeight: 120 }}
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={handleCreate} disabled={loading || !title.trim()}>
            {loading ? '创建中...' : '创建任务'}
          </button>
        </div>
      </div>
    </div>
  )
}
