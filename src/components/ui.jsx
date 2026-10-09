import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

export function Skeleton({ h = 16, w = "100%", r = 8, className = "" }) {
  return <span className={`skeleton ${className}`} style={{ height: h, width: w, borderRadius: r }} />;
}

export function TableSkeleton({ rows = 8 }) {
  return (
    <div className="card table-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="table-skeleton-row" key={i}>
          <Skeleton w={24} h={14} />
          <Skeleton w={30} h={30} r={15} />
          <Skeleton w="22%" h={14} />
          <Skeleton w="12%" h={14} />
          <Skeleton w="8%" h={14} className="hide-sm" />
          <Skeleton w="14%" h={30} className="hide-md" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "info", title, description, action, secondary }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {(action || secondary) && <div className="empty-actions">{action}{secondary}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, retrying }) {
  return (
    <div className="empty empty-error" role="alert">
      <span className="empty-icon"><Icon name="alert" size={22} /></span>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && (
        <div className="empty-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} disabled={retrying}>{retrying ? "Retrying…" : "Retry"}</button>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Segmented({ options, value, onChange, label, size = "md" }) {
  return (
    <div className={`segmented segmented-${size}`} role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        return (
          <button key={String(v)} type="button" className={value === v ? "active" : ""} aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <small className="field-error" role="alert">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ title, eyebrow, onClose, children, width = 460, labelledBy }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector("[data-autofocus]") ?? el?.querySelector(FOCUSABLE);
    first?.focus();
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab" && el) {
        const items = [...el.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const a = items[0], z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = lock;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? titleId} style={{ "--modal-w": `${width}px` }}>
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h2 id={titleId}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, body, confirmLabel = "Confirm", danger, busy, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onClose} width={420}>
      <p className="modal-body">{body}</p>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy} data-autofocus>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
