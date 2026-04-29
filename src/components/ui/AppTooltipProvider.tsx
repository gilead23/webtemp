import { ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

/**
 * Single TooltipProvider for the whole app.
 * delayDuration: time before tooltip opens on hover (ms).
 * skipDelayDuration: if user moves between adjacent triggers within this window, skip the delay.
 */
export function AppTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={150}>
      {children}
    </TooltipPrimitive.Provider>
  )
}
