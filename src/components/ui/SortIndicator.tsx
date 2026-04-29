import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

/**
 * Sort direction indicator for table column headers.
 *
 * Renders three states:
 *   active='asc'  → up chevron, full color
 *   active='desc' → down chevron, full color
 *   inactive      → up/down stack, muted
 *
 * Replaces the up/down/unsorted triangle glyphs that previously failed to render
 * on systems without a Unicode emoji font.
 */
export function SortIndicator({
  active,
  direction,
  size = 12,
}: {
  active: boolean
  direction?: 'asc' | 'desc'
  size?: number
}) {
  if (!active) {
    return (
      <ChevronsUpDown
        size={size}
        style={{ verticalAlign: 'middle', opacity: 0.4, marginLeft: 4 }}
        aria-hidden
      />
    )
  }
  const Icon = direction === 'asc' ? ChevronUp : ChevronDown
  return (
    <Icon
      size={size}
      style={{ verticalAlign: 'middle', color: 'var(--link)', marginLeft: 4 }}
      aria-hidden
    />
  )
}
