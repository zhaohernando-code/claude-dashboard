import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getIssue, listComments, getIssueStatus, retryIssue, parseUsageFromComments, formatTokens, type GHIssue, type GHComment, type UsageData } from '../api/github'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'

export default function TaskDetailPage() {
  const { owner, repo, number } = useParams<{ owner: string; repo: string; number: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [issue, setIssue] = useState<GHIssue | null>(null)
  const [comments, setComments] = useState<GHComment[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(0)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!owner || !repo || !number) return
    const [iss, cmts] = await Promise.all([
      getIssue(owner, repo, parseInt(number)),
      listComments(owner, repo, parseInt(number)),
    ])
    setIssue(iss)
    setComments(cmts)
    setUsage(parseUsageFromComments(cmts))
    setLoading(false)
    setLastRefreshedAt(Date.now())
    setSecondsAgo(0)
  }, [owner, repo, number])

  useEffect(() => { load() }, [load])

  // 运行中自动刷新（每 8 秒）
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

  // 更新"X 秒前"计数器
  useEffect(() => {
    if (lastRefreshedAt === 0) return
    const t = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshedAt) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [lastRefreshedAt])

  const status = issue ? getIssueStatus(issue) : null
  const statusKey = status?.replace('status:', '') as 'pending' | 'running' | 'completed' | 'failed' | undefined

  async function handleManualRefresh() {
    setRefreshing(true)
    try {
      await load()
      showToast('已刷新', 'success')
    } catch {
      showToast('刷新失败', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRetry() {
    if (!owner || !repo || !issue) return
    try {
      await retryIssue(owner, repo, issue)
      await load()
      showToast('已重新提交', 'success')
    } catch {
      showToast('操作失败', 'error')
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 24, color: 'var(--text2)' }}>
      <span className="spinner" /> 加载中...
    </div>
  )
  if (!issue) return <div className="error-msg">Issue 不存在</div>

  const refreshLabel = secondsAgo < 5 ? '刚刚' : `${secondsAgo} 秒前`

  return (
    <div>
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            style={{ fontSize: 12, opacity: autoRefresh ? 1 : 0.5 }}
          >
            {autoRefresh ? '⏸ 停止刷新' : '▶ 自动刷新'}
          </button>
          <button onClick={handleManualRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {refreshing
              ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 刷新中</>
              : '↻ 刷新'}
          </button>
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
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', marginBottom: usage ? 12 : 20, flexWrap: 'wrap' }}>
        <span>创建：{new Date(issue.created_at).toLocaleString('zh-CN')}</span>
        <span>更新：{new Date(issue.updated_at).toLocaleString('zh-CN')}</span>
        <a href={issue.html_url} target="_blank" rel="noreferrer">在 GitHub 查看 ↗</a>
      </div>

      {/* Token 用量 */}
      {usage && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>📊 Token 用量</span>
          <UsageStat label="输入" value={formatTokens(usage.input_tokens)} full={usage.input_tokens} />
          <UsageStat label="输出" value={formatTokens(usage.output_tokens)} full={usage.output_tokens} />
          {usage.cache_read_tokens > 0 && (
            <UsageStat label="缓存命中" value={formatTokens(usage.cache_read_tokens)} full={usage.cache_read_tokens} />
          )}
          <UsageStat
            label="合计"
            value={formatTokens(usage.input_tokens + usage.output_tokens)}
            full={usage.input_tokens + usage.output_tokens}
            highlight
          />
          {usage.cost_usd > 0 && (
            <UsageStat label="费用 (USD)" value={`$${usage.cost_usd.toFixed(6)}`} />
          )}
        </div>
      )}

      {/* 执行状态提示区 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
        <div style={{ fontWeight: 600 }}>
          执行输出 ({comments.length} 条评论)
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {autoRefresh && (
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              自动刷新中
            </span>
          )}
          {lastRefreshedAt > 0 && <span>· 最后刷新：{refreshLabel}</span>}
        </div>
      </div>

      {status === 'status:running' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--running)', marginBottom: 12, fontSize: 13 }}>
          <span className="spinner" /> Claude 正在执行中，每 8 秒自动刷新...
        </div>
      )}

      {status === 'status:pending' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--warning)', marginBottom: 12, fontSize: 13 }}>
          ⏳ 任务等待 Daemon 调度，将在下次轮询（最长 30 秒）后开始执行
        </div>
      )}

      {comments.length === 0 ? (
        <div className="empty">暂无执行输出</div>
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

function UsageStat({ label, value, full, highlight }: { label: string; value: string; full?: number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{label}</span>
      <span
        style={{ fontSize: 15, fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--primary)' : 'var(--text)' }}
        title={full !== undefined ? full.toLocaleString() : undefined}
      >
        {value}
      </span>
    </div>
  )
}
