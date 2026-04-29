import { ReactNode, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  title,
  children,
  onClose,
  width = 640,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  width?: number
}) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const updateScale = () => {
      const el = cardRef.current
      if (!el || typeof window === 'undefined') {
        setScale(1)
        return
      }
      const viewportHeight = window.innerHeight
      const margin = 48 // keep a little air around the modal
      const contentHeight = el.scrollHeight || el.offsetHeight
      if (!contentHeight) {
        setScale(1)
        return
      }
      const maxHeight = viewportHeight - margin
      const nextScale = Math.min(1, maxHeight / contentHeight)
      setScale(nextScale)
    }

    updateScale()

    const el = cardRef.current
    let observer: ResizeObserver | null = null

    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateScale()
      })
      observer.observe(el)
    } else {
      // Fallback: at least keep scale in sync with window resizes
      updateScale()
    }

    window.addEventListener('resize', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 2000,
        overflow: 'hidden',
      }}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        className="card stack"
        style={{
          width,
          maxWidth: '95vw',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            className="button ghost"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              minWidth: 28,
              minHeight: 28,
            }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}