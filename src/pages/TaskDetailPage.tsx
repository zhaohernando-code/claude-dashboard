import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getIssue, listComments, getIssueStatus, retryIssue, type GHIssue, type GHComment } from '../api/github'
import StatusBadge from '../components/StatusBadge'

export default function TaskDetailPage() {
  const { owner, repo, number } = useParams<{ owner: string; repo: string; number: string }>()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<GHIssue | null>(null)
  const [comments, setComments] = useState<GHComment[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!owner || !repo || !number) return
    try {
      const [iss, cmts] = await Promise.all([
        getIssue(owner, repo, parseInt(number)),
        listComments(owner, repo, parseInt(number)),
      ])
      setIssue(iss)
      setComments(cmts)
    } finally {
      setLoading(false)
    }
  }, [owner, repo, number])

  useEffect(() => { load() }, [load])

  // 运行中自动刷新
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

  const status = issue ? getIssueStatus(issue) : null
  const statusKey = status?.replace('status:', '') as 'pending' | 'running' | 'completed' | 'failed' | undefined

  async function handleRetry() {
    if (!owner || !repo || !issue) return
    await retryIssue(owner, repo, issue)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 24, color: 'var(--text2)' }}>
      <span className="spinner" /> 加载中...
    </div>
  )
  if (!issue) return <div className="error-msg">Issue 不存在</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>项目列表</span>
            {' › '}
            <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${owner}/${repo}`)}>
              {repo}
            </span>
            {' › '}
            #{issue.number}
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {issue.title}
            {statusKey && <StatusBadge status={statusKey} />}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            style={{ fontSize: 12, opacity: autoRefresh ? 1 : 0.5 }}
          >
            {autoRefresh ? '⏸ 停止刷新' : '▶ 自动刷新'}
          </button>
          <button onClick={load}>↻ 刷新</button>
          {(status === 'status:failed' || status === 'status:completed') && (
            <button className="primary" onClick={handleRetry}>↩ 重试</button>
          )}
        </div>
      </div>

      {/* Issue body */}
      {issue.body && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>任务描述</div>
          <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 13 }}>{issue.body}</pre>
        </div>
      )}

      {/* 元信息 */}
      <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text2)', marginBottom: 20 }}>
        <span>创建：{new Date(issue.created_at).toLocaleString('zh-CN')}</span>
        <span>更新：{new Date(issue.updated_at).toLocaleString('zh-CN')}</span>
        <a href={issue.html_url} target="_blank" rel="noreferrer">在 GitHub 查看 ↗</a>
      </div>

      {/* 执行输出（评论） */}
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        执行输出 ({comments.length} 条评论)
      </div>
      {status === 'status:running' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--running)', marginBottom: 12, fontSize: 13 }}>
          <span className="spinner" /> Claude 正在执行中...
        </div>
      )}
      {comments.length === 0 ? (
        <div className="empty">暂无评论</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map(c => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {c.user.login}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {new Date(c.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <pre className="output">{c.body}</pre>
            </div>
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
