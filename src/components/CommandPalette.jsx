import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import CoinLogo from "./CoinLogo";
import { Modal } from "./ui";
import { NAV_ITEMS, SHORTCUTS } from "./nav";
import { useData } from "../context/DataContext";
import { formatPrice } from "../lib/format";

export default function CommandPalette({ onClose }) {
  const { coins } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = NAV_ITEMS.filter((n) => !term || n.label.toLowerCase().includes(term)).map((n) => ({ kind: "page", id: n.to, n }));
    const matched = term
      ? coins.filter((c) => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term) || String(c.market_cap_rank) === term).slice(0, 8)
      : coins.slice(0, 5);
    return [...pages.slice(0, term ? 4 : 7), ...matched.map((c) => ({ kind: "coin", id: c.id, c }))];
  }, [q, coins]);

  useEffect(() => { listRef.current?.querySelector(".active")?.scrollIntoView({ block: "nearest" }); }, [idx]);

  function choose(r) {
    onClose();
    navigate(r.kind === "page" ? r.n.to : `/coin/${r.c.id}`);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[idx]) { e.preventDefault(); choose(results[idx]); }
  }

  return (
    <Modal onClose={onClose} width={560} labelledBy="palette-label">
      <div className="palette">
        <span id="palette-label" className="sr-only">Search</span>
        <div className="palette-input">
          <Icon name="search" size={17} />
          <input data-autofocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder="Search assets by name, symbol or rank…"
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[idx] ? `pal-${idx}` : undefined} />
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">No matches for “{q}”.</div>}
          {results.map((r, i) => (
            <button key={`${r.kind}-${r.id}`} id={`pal-${i}`} type="button" role="option" aria-selected={i === idx} className={`palette-row ${i === idx ? "active" : ""}`}
              onMouseEnter={() => setIdx(i)} onClick={() => choose(r)}>
              {r.kind === "page" ? <Icon name={r.n.icon} size={17} /> : <CoinLogo coin={r.c} size={20} />}
              <span>{r.kind === "page" ? r.n.label : r.c.name}</span>
              <small>{r.kind === "page" ? "Page" : r.c.symbol.toUpperCase()}</small>
              {r.kind === "coin" && <b>{formatPrice(r.c.current_price)}</b>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function ShortcutsModal({ onClose }) {
  return (
    <Modal title="Keyboard shortcuts" eyebrow="Help" onClose={onClose} width={480}>
      <ul className="shortcut-list">
        {SHORTCUTS.map((s) => (
          <li key={s.label}>
            <span>{s.label}</span>
            <span className="shortcut-keys">{s.keys.map((k, i) => (k === "then" ? <em key={i}>then</em> : <kbd key={i}>{k}</kbd>))}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
