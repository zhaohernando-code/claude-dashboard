const LABELS: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
}

interface Props {
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`badge ${status}`}>
      {status === 'running' && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 4, verticalAlign: 'middle', animation: 'pulse 1.5s infinite' }} />}
      {LABELS[status] || status}
    </span>
  )
}
