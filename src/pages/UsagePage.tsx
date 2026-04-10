import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listRepos, listIssues, listComments, getMe,
  parseUsageFromComments, formatTokens,
  type UsageData,
} from '../api/github'

interface TaskUsage {
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  usage: UsageData;
  created_at: string;
}

interface AggregatedUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  task_count: number;
}

function sumUsage(tasks: TaskUsage[]): AggregatedUsage {
  return tasks.reduce((acc, t) => ({
    input_tokens: acc.input_tokens + t.usage.input_tokens,
    output_tokens: acc.output_tokens + t.usage.output_tokens,
    cache_read_tokens: acc.cache_read_tokens + t.usage.cache_read_tokens,
    cache_creation_tokens: acc.cache_creation_tokens + t.usage.cache_creation_tokens,
    cost_usd: acc.cost_usd + t.usage.cost_usd,
    task_count: acc.task_count + 1,
  }), { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, cost_usd: 0, task_count: 0 })
}

export default function UsagePage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setTasks([])
    try {
      const me = await getMe()
      const allRepos = await listRepos(me.login)

      const result: TaskUsage[] = []

      for (const repo of allRepos) {
        const repoOwner = repo.owner.login
        setProgress(`扫描 ${repo.name}...`)
        const issues = await listIssues(repoOwner, repo.name, 'all')
        for (const issue of issues) {
          if (issue.comments === 0) continue
          const comments = await listComments(repoOwner, repo.name, issue.number)
          const usage = parseUsageFromComments(comments)
          if (usage) {
            result.push({
              owner: repoOwner,
              repo: repo.name,
              issueNumber: issue.number,
              issueTitle: issue.title,
              usage,
              created_at: issue.created_at,
            })
          }
        }
      }

      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setTasks(result)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredTasks = selectedRepo === 'all'
    ? tasks
    : tasks.filter(t => `${t.owner}/${t.repo}` === selectedRepo)

  const agg = sumUsage(filteredTasks)
  const repoOptions = Array.from(new Set(tasks.map(t => `${t.owner}/${t.repo}`)))

  return (
    <div>
      <div className="page-header">
        <h1>📊 Token 用量统计</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={selectedRepo}
            onChange={e => setSelectedRepo(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">全部项目</option>
            {repoOptions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button onClick={load}>↻ 刷新</button>
        </div>
      </div>

      {/* 汇总卡片 */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard label="任务数" value={agg.task_count.toString()} />
          <StatCard label="输入 Tokens" value={formatTokens(agg.input_tokens)} sub={agg.input_tokens.toLocaleString()} />
          <StatCard label="输出 Tokens" value={formatTokens(agg.output_tokens)} sub={agg.output_tokens.toLocaleString()} />
          <StatCard label="缓存命中 Tokens" value={formatTokens(agg.cache_read_tokens)} sub={agg.cache_read_tokens.toLocaleString()} />
          <StatCard label="合计 Tokens" value={formatTokens(agg.input_tokens + agg.output_tokens)} sub={(agg.input_tokens + agg.output_tokens).toLocaleString()} highlight />
          {agg.cost_usd > 0 && (
            <StatCard label="总费用 (USD)" value={`$${agg.cost_usd.toFixed(4)}`} />
          )}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 24, color: 'var(--text2)' }}>
          <span className="spinner" /> {progress || '加载中...'}
        </div>
      )}

      {/* 任务列表 */}
      {!loading && filteredTasks.length === 0 ? (
        <div className="empty">暂无用量数据<br /><span style={{ fontSize: 12 }}>任务完成后会自动记录 token 用量</span></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 100px', gap: 8, padding: '8px 16px', fontSize: 11, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
            <span>任务</span>
            <span style={{ textAlign: 'right' }}>输入</span>
            <span style={{ textAlign: 'right' }}>输出</span>
            <span style={{ textAlign: 'right' }}>合计</span>
            <span style={{ textAlign: 'right' }}>费用 (USD)</span>
          </div>
          {filteredTasks.map(t => {
            const total = t.usage.input_tokens + t.usage.output_tokens
            return (
              <div
                key={`${t.owner}/${t.repo}#${t.issueNumber}`}
                className="list-item"
                style={{ cursor: 'pointer', gridTemplateColumns: '1fr 80px 80px 80px 100px' }}
                onClick={() => navigate(`/projects/${t.owner}/${t.repo}/issues/${t.issueNumber}`)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{t.issueNumber} {t.issueTitle}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {t.owner}/{t.repo} · {new Date(t.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', minWidth: 80 }}>
                  {formatTokens(t.usage.input_tokens)}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', minWidth: 80 }}>
                  {formatTokens(t.usage.output_tokens)}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 80 }}>
                  {formatTokens(total)}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap', minWidth: 100 }}>
                  {t.usage.cost_usd > 0 ? `$${t.usage.cost_usd.toFixed(6)}` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? 'var(--primary)' : 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
