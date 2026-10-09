import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, { tone = "info", action, duration = 4200 } = {}) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t.slice(-3), { id, message, tone, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (m, o) => push(m, { ...o, tone: "success" }),
      error: (m, o) => push(m, { ...o, tone: "error", duration: 6500 }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <span>{t.message}</span>
            {t.action && (
              <button type="button" className="toast-action" onClick={() => { t.action.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
