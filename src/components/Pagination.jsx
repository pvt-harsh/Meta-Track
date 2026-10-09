import { useState } from "react";
import Icon from "./Icon";
import { formatInt } from "../lib/format";

function items(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "e", total];
  if (current >= total - 3) return [1, "s", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "s", current - 1, current, current + 1, "e", total];
}

export default function Pagination({ page, pageCount, totalItems, pageSize, onChange }) {
  const [jump, setJump] = useState("");
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  function submit(e) {
    e.preventDefault();
    const n = Number(jump);
    if (Number.isInteger(n) && n >= 1 && n <= pageCount) { onChange(n); setJump(""); }
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        {formatInt(first)}–{formatInt(last)} of {formatInt(totalItems)}
      </span>
      <div className="pagination-pages">
        <button type="button" className="page-btn" onClick={() => onChange(1)} disabled={page === 1} aria-label="First page"><Icon name="chevronsLeft" size={15} /></button>
        <button type="button" className="page-btn" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page"><Icon name="chevronLeft" size={15} /></button>
        {items(page, pageCount).map((it) =>
          typeof it === "string" ? <span className="page-gap" key={it} aria-hidden="true">…</span> : (
            <button key={it} type="button" className={`page-btn ${it === page ? "active" : ""} ${Math.abs(it - page) > 1 && it !== 1 && it !== pageCount ? "hide-sm" : ""}`}
              onClick={() => onChange(it)} aria-label={`Page ${it}`} aria-current={it === page ? "page" : undefined}>
              {it}
            </button>
          )
        )}
        <button type="button" className="page-btn" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Next page"><Icon name="chevronRight" size={15} /></button>
        <button type="button" className="page-btn" onClick={() => onChange(pageCount)} disabled={page === pageCount} aria-label="Last page"><Icon name="chevronsRight" size={15} /></button>
      </div>
      <form className="pagination-jump" onSubmit={submit}>
        <label htmlFor="page-jump">Go to</label>
        <input id="page-jump" type="number" inputMode="numeric" min="1" max={pageCount} value={jump} onChange={(e) => setJump(e.target.value)} placeholder={`1–${pageCount}`} />
        <button type="submit" className="btn btn-sm">Go</button>
      </form>
    </nav>
  );
}
