import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'

type Position = { x: number; y: number }

type Options = {
  storageKey: string
  enabled: boolean
  margin?: number
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

const DRAG_THRESHOLD = 4

function clampPosition(position: Position, width: number, height: number, margin: number): Position {
  const maxX = Math.max(margin, window.innerWidth - width - margin)
  const maxY = Math.max(margin, window.innerHeight - height - margin)
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  }
}

function readPosition(storageKey: string): Position | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !Number.isFinite((value as Position).x) || !Number.isFinite((value as Position).y)) {
      window.localStorage.removeItem(storageKey)
      return null
    }
    return value as Position
  } catch {
    window.localStorage.removeItem(storageKey)
    return null
  }
}

export function useDraggableFloatingPanel({ storageKey, enabled, margin = 12 }: Options) {
  const panelRef = useRef<HTMLElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const hasLoadedRef = useRef(false)
  const previousUserSelectRef = useRef<string | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!enabled || hasLoadedRef.current) return
    hasLoadedRef.current = true
    const saved = readPosition(storageKey)
    if (!saved) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (rect) setPosition(clampPosition(saved, rect.width, rect.height, margin))
    else setPosition(saved)
  }, [enabled, margin, storageKey])

  useEffect(() => {
    if (!enabled || !position) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(position))
    } catch {
      // Position persistence is optional and must not break the widget.
    }
  }, [enabled, position, storageKey])

  useEffect(() => {
    if (!enabled) return
    const keepPanelVisible = () => {
      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect || !position) return
      const clamped = clampPosition(position, rect.width, rect.height, margin)
      if (clamped.x !== position.x || clamped.y !== position.y) setPosition(clamped)
    }
    window.addEventListener('resize', keepPanelVisible)
    return () => window.removeEventListener('resize', keepPanelVisible)
  }, [enabled, margin, position])

  useEffect(() => {
    if (!isDragging) return
    previousUserSelectRef.current = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.userSelect = previousUserSelectRef.current ?? ''
      previousUserSelectRef.current = null
    }
  }, [isDragging])

  useEffect(() => () => {
    dragStateRef.current = null
    if (previousUserSelectRef.current !== null) {
      document.body.style.userSelect = previousUserSelectRef.current
    }
  }, [])

  function finishDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragStateRef.current = null
    setIsDragging(false)
  }

  const dragHandleProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button > 0 || (event.target as HTMLElement).closest('button, a, input, textarea, select')) return
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      const panel = panelRef.current
      if (!enabled || !drag || drag.pointerId !== event.pointerId || !panel) return
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
      if (distance < DRAG_THRESHOLD) return
      event.preventDefault()
      setIsDragging(true)
      const rect = panel.getBoundingClientRect()
      setPosition(clampPosition({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }, rect.width, rect.height, margin))
    },
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
      if (dragStateRef.current?.pointerId === event.pointerId) {
        dragStateRef.current = null
        setIsDragging(false)
      }
    },
  }

  function resetPosition() {
    try { window.localStorage.removeItem(storageKey) } catch { /* ignore unavailable storage */ }
    setPosition(null)
  }

  return {
    panelRef,
    position,
    isDragging,
    hasCustomPosition: position !== null,
    dragHandleProps,
    resetPosition,
  }
}
