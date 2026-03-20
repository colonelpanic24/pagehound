/**
 * Minimal toast store — compatible with the shadcn/ui Toaster component.
 * A full implementation would use useReducer; this is intentionally simple for Phase 1.
 */
import * as React from 'react'
import type { ToastProps, ToastActionElement } from '@/components/ui/toast'

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

type ToastId = string

export type ToasterToast = ToastProps & {
  id: ToastId
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type ToastState = { toasts: ToasterToast[] }

let memState: ToastState = { toasts: [] }
const listeners: Array<(state: ToastState) => void> = []

function dispatch(toasts: ToasterToast[]) {
  memState = { toasts }
  listeners.forEach((l) => l(memState))
}

let count = 0
function genId(): ToastId {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

export function toast(props: Omit<ToasterToast, 'id'>) {
  const id = genId()
  const newToast: ToasterToast = { ...props, id }
  const next = [newToast, ...memState.toasts].slice(0, TOAST_LIMIT)
  dispatch(next)
  setTimeout(() => {
    dispatch(memState.toasts.filter((t) => t.id !== id))
  }, TOAST_REMOVE_DELAY)
  return id
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts: state.toasts, toast }
}
