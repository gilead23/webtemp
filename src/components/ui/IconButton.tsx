import { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Loader2 } from 'lucide-react'

/**
 * IconButton — bordered, accessible icon-only button.
 *
 * Variants:
 *   default — neutral (line border, muted icon, brightens on hover)
 *   danger  — destructive (red on hover; reserved for delete/destroy actions)
 *   ghost   — borderless (for tight rows where chrome would dominate)
 *
 * Sizes:
 *   sm — 28px target, 14px icon (dense table rows)
 *   md — 32px target, 16px icon (default)
 *
 * Required: `label` for accessibility (rendered into aria-label and tooltip).
 *
 * States covered: hover, focus-visible (keyboard ring), active, disabled, loading.
 * Loading replaces the icon with a spinner and disables interaction.
 */

type Variant = 'default' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  /** Lucide icon component or any ReactNode. Will be sized via the icon-button-icon CSS sizing. */
  icon: ReactNode
  /** Accessible label. Used for aria-label AND tooltip text. */
  label: string
  /** Visual variant. Default: 'default'. */
  variant?: Variant
  /** Size variant. Default: 'md'. */
  size?: Size
  /** Show spinner and disable interaction. */
  loading?: boolean
  /** Hide the tooltip (still keeps aria-label). */
  noTooltip?: boolean
  /** Tooltip side. Default: 'top'. */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    variant = 'default',
    size = 'md',
    loading = false,
    noTooltip = false,
    tooltipSide = 'top',
    disabled,
    className,
    ...rest
  },
  ref,
) {
  const dim = size === 'sm' ? 28 : 32
  const iconSize = size === 'sm' ? 14 : 16
  const isDisabled = disabled || loading

  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      className={['icon-button', className].filter(Boolean).join(' ')}
      style={{ width: dim, height: dim }}
      {...rest}
    >
      <span className="icon-button-glyph" style={{ width: iconSize, height: iconSize }}>
        {loading ? <Loader2 size={iconSize} className="icon-button-spin" /> : icon}
      </span>
    </button>
  )

  if (noTooltip) return button

  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>{button}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={tooltipSide}
          sideOffset={6}
          className="icon-button-tooltip"
        >
          {label}
          <TooltipPrimitive.Arrow className="icon-button-tooltip-arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
})

/**
 * IconButtonGroup — wraps a row of IconButtons with consistent gap.
 * Use in table rows for the action column.
 */
export function IconButtonGroup({ children, gap = 4 }: { children: ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap, justifyContent: 'center' }}>
      {children}
    </div>
  )
}

/**
 * IconLink — same visuals as IconButton, but renders an <a> via the `as` slot.
 * Use for navigation actions (e.g. router Link components).
 *
 * Pass any link-like component as `as`, e.g. `as={Link}` from react-router.
 * The component must accept ref and standard anchor props.
 */
type IconLinkProps = {
  icon: ReactNode
  label: string
  variant?: Variant
  size?: Size
  noTooltip?: boolean
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  /** Component to render. Defaults to 'a'. Pass router Link here. */
  as?: React.ElementType
  className?: string
  // Anchor / Link props passthrough
  href?: string
  to?: string
  onClick?: (e: React.MouseEvent) => void
  onMouseDown?: (e: React.MouseEvent) => void
  target?: string
  rel?: string
}

export function IconLink({
  icon,
  label,
  variant = 'default',
  size = 'md',
  noTooltip = false,
  tooltipSide = 'top',
  as: As = 'a',
  className,
  ...rest
}: IconLinkProps) {
  const dim = size === 'sm' ? 28 : 32
  const iconSize = size === 'sm' ? 14 : 16

  const link = (
    <As
      aria-label={label}
      data-variant={variant}
      data-size={size}
      className={['icon-button', className].filter(Boolean).join(' ')}
      style={{ width: dim, height: dim, textDecoration: 'none' }}
      {...rest}
    >
      <span className="icon-button-glyph" style={{ width: iconSize, height: iconSize }}>
        {icon}
      </span>
    </As>
  )

  if (noTooltip) return link

  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>{link}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={tooltipSide}
          sideOffset={6}
          className="icon-button-tooltip"
        >
          {label}
          <TooltipPrimitive.Arrow className="icon-button-tooltip-arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
