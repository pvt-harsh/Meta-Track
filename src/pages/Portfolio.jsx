import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import CoinLogo from "../components/CoinLogo";
import { Donut, SERIES_COLORS } from "../components/Charts";
import { Pct } from "../components/CoinTable";
import { ConfirmModal, EmptyState, Field, Modal, PageHeader } from "../components/ui";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { useToast } from "../context/ToastContext";
import { currencyMeta, formatDate, formatMoney, formatNumber, formatPercent, formatPrice, fromActive, timeAgo, toActive, tone } from "../lib/format";
import { useDocumentTitle } from "../hooks";

const today = () => new Date().toISOString().slice(0, 10);

function HoldingForm({ initial, onClose }) {
  const { coins, byId } = useData();
  const { addHolding, editHolding } = useStore();
  const toast = useToast();
  const editing = Boolean(initial);
  const [f, setF] = useState(() => initial ? {
    coinId: initial.coinId, quantity: String(initial.quantity), price: String(Number(toActive(initial.buyPriceUsd).toPrecision(8))), date: initial.date ?? today(), notes: initial.notes ?? "",
  } : { coinId: "", quantity: "", price: "", date: today(), notes: "" });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const sym = currencyMeta().code.toUpperCase();

  function submit(e) {
    e.preventDefault();
    const err = {};
    if (!f.coinId) err.coinId = "Choose an asset.";
    if (!(Number(f.quantity) > 0)) err.quantity = "Enter a quantity greater than 0.";
    if (!(Number(f.price) >= 0) || f.price === "") err.price = "Enter the price you paid per coin.";
    if (!f.date || f.date > today()) err.date = "Pick a date that isn't in the future.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const coin = byId.get(f.coinId);
    const payload = { coinId: f.coinId, symbol: coin?.symbol?.toUpperCase(), quantity: Number(f.quantity), buyPriceUsd: fromActive(f.price), date: f.date, notes: f.notes.trim().slice(0, 200) };
    if (editing) { editHolding(initial.id, payload); toast.success("Holding updated."); } else { addHolding(payload); toast.success("Holding added to your portfolio."); }
    onClose();
  }

  return (
    <Modal eyebrow="Portfolio" title={editing ? "Edit holding" : "Add holding"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Asset" htmlFor="h-coin" error={errors.coinId}>
          <select id="h-coin" value={f.coinId} onChange={set("coinId")} disabled={editing} data-autofocus>
            <option value="">Select an asset</option>
            {coins.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Quantity" htmlFor="h-qty" error={errors.quantity}><input id="h-qty" type="number" inputMode="decimal" min="0" step="any" value={f.quantity} onChange={set("quantity")} placeholder="0.25" /></Field>
          <Field label={`Buy price per coin (${sym})`} htmlFor="h-price" error={errors.price} hint="Entered in your display currency."><input id="h-price" type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={set("price")} placeholder="0.00" /></Field>
        </div>
        <Field label="Purchase date" htmlFor="h-date" error={errors.date}><input id="h-date" type="date" max={today()} value={f.date} onChange={set("date")} /></Field>
        <Field label="Notes (optional)" htmlFor="h-notes"><input id="h-notes" type="text" maxLength={200} value={f.notes} onChange={set("notes")} placeholder="Exchange, reason, plan…" /></Field>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Add holding"}</button></div>
      </form>
    </Modal>
  );
}

export default function Portfolio() {
  const { requireAuth } = useAuth();
  useDocumentTitle("Portfolio");
  const { byId, loading, fmtKey } = useData();
  const { portfolio, removeHolding, activity } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(null); 
  const [del, setDel] = useState(null);

  const rows = useMemo(() => portfolio.map((h) => {
    const coin = byId.get(h.coinId);
    const cost = h.quantity * h.buyPriceUsd;
    const value = coin ? h.quantity * coin.current_price : null;
    return { h, coin, cost, value, pnl: value == null ? null : value - cost, pct: value == null || !cost ? null : ((value - cost) / cost) * 100 };
  }), [portfolio, byId]);

  const totals = useMemo(() => {
    const priced = rows.filter((r) => r.value != null);
    const value = priced.reduce((a, r) => a + r.value, 0);
    const cost = priced.reduce((a, r) => a + r.cost, 0);
    const ranked = priced.filter((r) => r.pct != null).sort((a, b) => b.pct - a.pct);
    return { value, cost, pnl: value - cost, pct: cost ? ((value - cost) / cost) * 100 : null, best: ranked[0], worst: ranked[ranked.length - 1], unpriced: rows.length - priced.length };
  }, [rows]);

  const slices = useMemo(() => {
    const m = new Map();
    for (const r of rows) if (r.value != null) m.set(r.h.coinId, { id: r.h.coinId, label: r.coin.symbol.toUpperCase(), value: (m.get(r.h.coinId)?.value ?? 0) + r.value });
    return [...m.values()].sort((a, b) => b.value - a.value).map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length] === undefined ? "#888" : ["#8b7cff", "#4fc3f7", "#5fd6a0", "#ff8fb1", "#ffc86b", "#ff9f6b", "#6be3d6", "#9a9ab0"][i % 8] }));
  }, [rows]);
  const portfolioActivity = activity.filter((a) => a.link === "/portfolio").slice(0, 5);

  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Your holdings" description="Cost basis versus today's market value. Stored in this browser — no wallet or exchange connection."
        actions={<button type="button" className="btn btn-primary" onClick={() => requireAuth("portfolio") && setForm("new")}><Icon name="plus" size={15} /> Add holding</button>} />

      {portfolio.length === 0 ? (
        <EmptyState icon="portfolio" title="No holdings yet" description="Add what you own and what you paid. MetaTrack calculates value, profit and allocation from live prices."
          action={<button type="button" className="btn btn-primary" onClick={() => requireAuth("portfolio") && setForm("new")}>Add your first asset</button>} />
      ) : (
        <div data-fmt={fmtKey}>
          <div className="stats">
            <div className="stat stat-lead"><span className="stat-label">Current value</span><strong className="stat-value big">{loading ? "…" : formatMoney(totals.value)}</strong></div>
            <div className="stat"><span className="stat-label">Total invested</span><strong className="stat-value">{formatMoney(totals.cost)}</strong></div>
            <div className="stat"><span className="stat-label">Profit / loss</span><strong className={`stat-value pct-${tone(totals.pnl)}`}>{totals.pnl > 0 ? "+" : totals.pnl < 0 ? "−" : ""}{formatMoney(Math.abs(totals.pnl))}</strong>
              <span className={`stat-sub pct-${tone(totals.pct)}`}>{formatPercent(totals.pct)}</span></div>
            <div className="stat"><span className="stat-label">Best performer</span><strong className="stat-value">{totals.best ? totals.best.coin.symbol.toUpperCase() : "—"}</strong>{totals.best && <span className="stat-sub"><Pct value={totals.best.pct} /></span>}</div>
            <div className="stat"><span className="stat-label">Worst performer</span><strong className="stat-value">{totals.worst && totals.worst !== totals.best ? totals.worst.coin.symbol.toUpperCase() : "—"}</strong>{totals.worst && totals.worst !== totals.best && <span className="stat-sub"><Pct value={totals.worst.pct} /></span>}</div>
          </div>
          {totals.unpriced > 0 && <p className="banner banner-warn" role="status">{totals.unpriced} holding(s) aren't in the loaded market range, so they're excluded from totals. Raise market coverage in Settings.</p>}

          <div className="grid-pf">
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Positions</span><h2>Holdings</h2></div></div>
              <div className="table-wrap flat">
                <table className="coin-table">
                  <thead><tr><th>Asset</th><th className="num">Quantity</th><th className="num hide-sm">Avg. buy</th><th className="num">Value</th><th className="num">P / L</th><th className="actions-col"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {rows.map(({ h, coin, value, pnl, pct }) => (
                      <tr key={h.id}>
                        <td><button type="button" className="asset-cell" onClick={() => coin && navigate(`/coin/${coin.id}`)}><CoinLogo coin={coin ?? { symbol: h.symbol }} size={30} /><span><b>{coin?.name ?? h.coinId}</b><small>{formatDate(h.date ?? h.createdAt)}{h.notes ? ` · ${h.notes}` : ""}</small></span></button></td>
                        <td className="num">{formatNumber(h.quantity, 8)}</td>
                        <td className="num hide-sm">{formatPrice(h.buyPriceUsd)}</td>
                        <td className="num strong">{value == null ? "—" : formatMoney(value)}</td>
                        <td className="num">{pnl == null ? "—" : <><span className={`pct-${tone(pnl)}`}>{pnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pnl))}</span><br /><Pct value={pct} /></>}</td>
                        <td className="actions-col"><div className="row-actions">
                          <button type="button" className="icon-btn" onClick={() => setForm(h)} aria-label={`Edit ${coin?.name ?? h.coinId} holding`}><Icon name="edit" size={15} /></button>
                          <button type="button" className="icon-btn" onClick={() => setDel(h)} aria-label={`Remove ${coin?.name ?? h.coinId} holding`}><Icon name="trash" size={15} /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="stack">
              <section className="card">
                <div className="card-head"><div><span className="eyebrow">Allocation</span><h2>By value</h2></div></div>
                {slices.length === 0 ? <p className="muted small">Allocation appears once prices load.</p> : (
                  <div className="alloc">
                    <Donut slices={slices} center={<><b>{slices.length}</b><small>asset{slices.length > 1 ? "s" : ""}</small></>} />
                    <ul className="alloc-list">
                      {slices.map((s) => <li key={s.id}><i style={{ background: s.color }} /><span>{s.label}</span><b>{((s.value / totals.value) * 100).toFixed(1)}%</b></li>)}
                    </ul>
                  </div>
                )}
              </section>
              <section className="card">
                <div className="card-head"><div><span className="eyebrow">Log</span><h2>Recent activity</h2></div></div>
                {portfolioActivity.length === 0 ? <p className="muted small">No recent changes.</p> : (
                  <ul className="activity">{portfolioActivity.map((a) => <li key={a.id}><span>{a.text}</span><small>{timeAgo(a.at)}</small></li>)}</ul>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}

      {form && <HoldingForm initial={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {del && <ConfirmModal title="Remove this holding?" body="It will be removed from your portfolio totals. This can't be undone." confirmLabel="Remove" danger
        onClose={() => setDel(null)} onConfirm={() => { removeHolding(del.id); setDel(null); toast.success("Holding removed."); }} />}
      <Link to="/markets" className="sr-only">Browse markets</Link>
    </>
  );
}
