import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastCtx {
  showToast: (message: string, type?: ToastItem['type']) => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
