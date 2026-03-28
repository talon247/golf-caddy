import { useRef, useState, type ReactNode, type TouchEvent, type MouseEvent } from 'react'

interface SwipeToDeleteProps {
  children: ReactNode
  onDelete: () => void
}

const SWIPE_THRESHOLD = 80
const DELETE_BUTTON_WIDTH = 80

export default function SwipeToDelete({ children, onDelete }: SwipeToDeleteProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isSwiping, setIsSwiping] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const currentX = useRef(0)
  const locked = useRef(false)

  function handleTouchStart(e: TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    currentX.current = isOpen ? -DELETE_BUTTON_WIDTH : 0
    locked.current = false
    setIsSwiping(false)
  }

  function handleTouchMove(e: TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Lock direction on first significant move
    if (!locked.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      locked.current = true
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll — bail out
        return
      }
    }

    if (!locked.current) return
    if (Math.abs(dy) > Math.abs(dx) && !isSwiping) return

    setIsSwiping(true)
    const base = isOpen ? -DELETE_BUTTON_WIDTH : 0
    const raw = base + dx
    // Clamp: no positive offset, max negative = DELETE_BUTTON_WIDTH + some rubber band
    const clamped = Math.max(-DELETE_BUTTON_WIDTH - 20, Math.min(0, raw))
    setOffsetX(clamped)
  }

  function handleTouchEnd() {
    if (!isSwiping) return
    setIsSwiping(false)

    if (offsetX < -SWIPE_THRESHOLD) {
      setOffsetX(-DELETE_BUTTON_WIDTH)
      setIsOpen(true)
    } else {
      setOffsetX(0)
      setIsOpen(false)
    }
  }

  function handleDeleteClick(e: MouseEvent) {
    e.stopPropagation()
    onDelete()
  }

  function handleClose() {
    setOffsetX(0)
    setIsOpen(false)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl group">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={handleDeleteClick}
          className="h-full px-5 bg-red-600 text-white font-bold text-sm flex items-center justify-center"
          style={{ width: DELETE_BUTTON_WIDTH }}
          aria-label="Delete round"
        >
          Delete
        </button>
      </div>

      {/* Sliding content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isOpen ? handleClose : undefined}
        className="relative z-10"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s ease-out',
        }}
      >
        {children}
      </div>

      {/* Desktop hover delete icon */}
      <button
        onClick={handleDeleteClick}
        className="absolute top-3 right-3 z-20 hidden group-hover:flex items-center justify-center w-8 h-8 rounded-full bg-red-600/90 text-white hover:bg-red-700 transition-colors"
        aria-label="Delete round"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1.5 14a2 2 0 01-2 2h-7a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      </button>
    </div>
  )
}
