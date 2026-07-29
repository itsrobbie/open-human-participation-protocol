import { createContext, useCallback, useContext, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            aria-live="polite"
            className={`pointer-events-auto rounded-lg px-4 py-3 shadow-lg border text-sm font-medium animate-slide-in max-w-sm ${typeStyles[t.type]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-current opacity-60 hover:opacity-100 text-lg leading-none"
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
  info: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200',
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
