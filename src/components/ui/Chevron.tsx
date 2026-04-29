import { ChevronRight } from 'lucide-react'

/**
 * Expand/collapse chevron. Rotates 90° when open.
 * Replaces the right-pointing triangle glyph used for tree nodes and section headers.
 */
export function Chevron({ open, size = 12 }: { open: boolean; size?: number }) {
  return (
    <ChevronRight
      size={size}
      style={{
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease',
        verticalAlign: 'middle',
      }}
      aria-hidden
    />
  )
}
