import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react"

// A small toast, styled after VVD's own snackbar. (The host's snackbar lives in
// its design system, which is only shared with first-party tools, so a
// third-party tool brings its own.) One at a time: a new toast replaces the
// last, so "Adding…" turns into "Added" in place.

export type Toast = {
  tone?: "neutral" | "success" | "error"
  message: ReactNode
  action?: { label: string; onClick: () => void }
  /** Stays until replaced or dismissed (progress, errors). Otherwise it fades after a few seconds. */
  sticky?: boolean
}

const DURATION = 4000

const ToastContext = createContext<(toast: Toast | null) => void>(() => {})

/** `show(toast)` replaces the current toast; `show(null)` hides it. */
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children, closeLabel }: { children: ReactNode; closeLabel: string }) {
  const [current, setCurrent] = useState<(Toast & { key: number }) | null>(null)
  const show = useCallback((toast: Toast | null) => setCurrent(toast && { ...toast, key: Date.now() }), [])

  useEffect(() => {
    if (!current || current.sticky) return
    const timer = setTimeout(() => setCurrent((c) => (c?.key === current.key ? null : c)), DURATION)
    return () => clearTimeout(timer)
  }, [current])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pm-toasts" aria-live="polite">
        {current && (
          <div key={current.key} className="pm-toast" data-tone={current.tone ?? "neutral"} role="status">
            {current.tone === "success" && <CheckIcon />}
            {current.tone === "error" && <AlertIcon />}
            <span className="pm-toast-message">{current.message}</span>
            {current.action && (
              <button type="button" className="pm-toast-action"
                onClick={() => { current.action!.onClick(); setCurrent(null) }}>
                {current.action.label}
              </button>
            )}
            {(current.sticky || current.tone === "error") && (
              <button type="button" className="pm-toast-close" aria-label={closeLabel} onClick={() => setCurrent(null)}>×</button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

const iconStyle = { width: 14, height: 14, flex: "none", display: "block", fill: "none", stroke: "currentColor", strokeWidth: 2.5 } as const

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={iconStyle}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={iconStyle}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16.5v.01" />
    </svg>
  )
}

export const TOAST_CSS = `
.pm-toasts { position: absolute; left: 0; right: 0; bottom: 24px; z-index: 60; display: flex; justify-content: center;
  pointer-events: none; padding: 0 16px; }
.pm-toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: min(460px, 100%);
  padding: 9px 10px 9px 14px; border-radius: 12px; background: rgba(24, 20, 16, 0.96); color: #f2ebe1;
  border: 1px solid rgba(255, 235, 205, 0.12); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  font-size: 13.5px; line-height: 1.3; animation: pm-toast-in 0.18s ease-out; }
.pm-toast[data-tone="success"] svg { color: #7fc79a; }
.pm-toast[data-tone="error"] svg { color: #e07a6a; }
.pm-toast-message { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-toast-action { flex: none; padding: 4px 10px; border-radius: 8px; border: 0; background: rgba(255, 255, 255, 0.1);
  color: inherit; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.pm-toast-action:hover { background: rgba(255, 255, 255, 0.18); }
.pm-toast-close { flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent;
  color: inherit; opacity: 0.6; font-size: 18px; line-height: 1; cursor: pointer; }
.pm-toast-close:hover { opacity: 1; background: rgba(255, 255, 255, 0.1); }
.pm-toast-action:focus-visible, .pm-toast-close:focus-visible { outline: 2px solid var(--pm-accent); outline-offset: 2px; }
@keyframes pm-toast-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .pm-toast { animation: none; } }
`
