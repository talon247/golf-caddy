import { create } from 'zustand'

interface Toast {
  id: string
  message: string
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message) => {
    const id = crypto.randomUUID()
    set(state => ({ toasts: [...state.toasts, { id, message }] }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
  dismissToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },
}))
