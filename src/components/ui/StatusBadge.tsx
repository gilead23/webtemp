import { Check, X, AlertTriangle } from 'lucide-react'

/**
 * Status badge replacing PASS / FAIL / ERR text labels.
 * Uses semantic colors from the CSS theme.
 */
export function StatusBadge({
  status,
  showLabel = true,
}: {
  status: 'pass' | 'fail' | 'error'
  showLabel?: boolean
}) {
  const map = {
    pass:  { Icon: Check,          color: 'var(--ok)',   label: 'PASS' },
    fail:  { Icon: X,              color: 'var(--err)',  label: 'FAIL' },
    error: { Icon: AlertTriangle,  color: 'var(--warn)', label: 'ERR'  },
  } as const
  const { Icon, color, label } = map[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      color,
      fontWeight: 600,
    }}>
      <Icon size={14} aria-hidden />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
