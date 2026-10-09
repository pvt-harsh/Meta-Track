import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import CoinLogo from "../components/CoinLogo";
import { ConfirmModal, EmptyState, Field, Modal, PageHeader, Segmented, Toggle } from "../components/ui";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { useToast } from "../context/ToastContext";
import { currencyMeta, formatDateTime, formatPrice, fromActive, toActive } from "../lib/format";
import { useDocumentTitle } from "../hooks";

const TYPES = [
  { id: "above", label: "Price above" },
  { id: "below", label: "Price below" },
  { id: "change", label: "24h move of ±%" },
];

export const describe = (a) => (a.type === "change" ? `24h move of ±${a.target}% or more` : `${a.type === "above" ? "Price at or above" : "Price at or below"} ${formatPrice(a.target)}`);

function AlertForm({ initial, presetCoin, onClose }) {
  const { coins, byId } = useData();
  const { addAlert, editAlert } = useStore();
  const toast = useToast();
  const editing = Boolean(initial);
  const [f, setF] = useState(() => initial ? {
    coinId: initial.coinId, type: initial.type, target: String(initial.type === "change" ? initial.target : Number(toActive(initial.target).toPrecision(8))),
  } : { coinId: presetCoin ?? "", type: "above", target: "" });
  const [err, setErr] = useState({});
  const coin = byId.get(f.coinId);
  const sym = currencyMeta().code.toUpperCase();

  function submit(e) {
    e.preventDefault();
    const er = {};
    const t = Number(f.target);
    if (!f.coinId) er.coinId = "Choose an asset.";
    if (!(t > 0)) er.target = "Enter a value greater than 0.";
    else if (f.type === "change" && t > 1000) er.target = "That percentage is too large.";
    else if (coin && f.type === "above" && fromActive(t) <= coin.current_price) er.target = `Must be above the current price (${formatPrice(coin.current_price)}).`;
    else if (coin && f.type === "below" && fromActive(t) >= coin.current_price) er.target = `Must be below the current price (${formatPrice(coin.current_price)}).`;
    setErr(er);
    if (Object.keys(er).length) return;
    const payload = { coinId: f.coinId, name: coin?.name, symbol: coin?.symbol?.toUpperCase(), type: f.type, target: f.type === "change" ? t : fromActive(t) };
    if (editing) { editAlert(initial.id, payload); toast.success("Alert updated and re-armed."); } else { addAlert(payload); toast.success("Alert created."); }
    onClose();
  }
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Modal eyebrow="Price alert" title={editing ? "Edit alert" : "Create alert"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Asset" htmlFor="a-coin" error={err.coinId} hint={coin ? `Current price ${formatPrice(coin.current_price)}` : undefined}>
          <select id="a-coin" value={f.coinId} onChange={set("coinId")} disabled={editing} data-autofocus>
            <option value="">Select an asset</option>
            {coins.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
          </select>
        </Field>
        <Field label="Condition" htmlFor="a-type">
          <Segmented label="Condition" value={f.type} onChange={(type) => setF((s) => ({ ...s, type, target: "" }))} options={TYPES.map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label={f.type === "change" ? "Threshold (%)" : `Target price (${sym})`} htmlFor="a-target" error={err.target}>
          <input id="a-target" type="number" inputMode="decimal" min="0" step="any" value={f.target} onChange={set("target")} placeholder={f.type === "change" ? "5" : "0.00"} />
        </Field>
        <p className="muted small">Alerts are checked each time market data refreshes while MetaTrack is open. They don't run when the app is closed.</p>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary">{editing ? "Save alert" : "Create alert"}</button></div>
      </form>
    </Modal>
  );
}

export default function Alerts() {
  const { requireAuth } = useAuth();
  useDocumentTitle("Alerts");
  const { byId, fmtKey } = useData();
  const { alerts, setAlertActive, removeAlert } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [tab, setTab] = useState("all");

  const shown = useMemo(() => alerts.filter((a) => tab === "all" || (tab === "active" ? a.active && !a.triggered : a.triggered)), [alerts, tab]);
  const counts = { all: alerts.length, active: alerts.filter((a) => a.active && !a.triggered).length, triggered: alerts.filter((a) => a.triggered).length };

  return (
    <>
      <PageHeader eyebrow="Alerts" title="Price alerts" description="Get notified when an asset crosses a price or moves sharply. Checked on every market refresh while MetaTrack is open."
        actions={<button type="button" className="btn btn-primary" onClick={() => requireAuth("alerts") && setForm("new")}><Icon name="plus" size={15} /> Create alert</button>} />

      {alerts.length === 0 ? (
        <EmptyState icon="bell" title="No active alerts" description="Create one — for example, notify me when Bitcoin rises above a level you're watching."
          action={<button type="button" className="btn btn-primary" onClick={() => requireAuth("alerts") && setForm("new")}>Create alert</button>}
          secondary={<Link to="/markets" className="btn">Explore markets</Link>} />
      ) : (
        <div data-fmt={fmtKey}>
          <div className="toolbar">
            <Segmented size="sm" label="Show" value={tab} onChange={setTab} options={[{ value: "all", label: `All ${counts.all}` }, { value: "active", label: `Active ${counts.active}` }, { value: "triggered", label: `Triggered ${counts.triggered}` }]} />
          </div>
          {shown.length === 0 ? <EmptyState icon="bell" title="Nothing here" description="No alerts in this view." /> : (
            <ul className="alert-list">
              {shown.map((a) => {
                const coin = byId.get(a.coinId);
                const state = a.triggered ? "triggered" : a.active ? "active" : "paused";
                return (
                  <li key={a.id} className={`card alert-row alert-${state}`}>
                    <button type="button" className="asset-cell" onClick={() => navigate(`/coin/${a.coinId}`)}>
                      <CoinLogo coin={coin ?? { symbol: a.symbol }} size={34} />
                      <span><b>{a.name ?? coin?.name ?? a.coinId}</b><small>{describe(a)}</small></span>
                    </button>
                    <div className="alert-meta">
                      <span className={`status status-${state}`}><i />{state === "triggered" ? "Triggered" : state === "active" ? "Active" : "Paused"}</span>
                      <small>{a.triggered ? `${formatDateTime(a.triggeredAt)} at ${formatPrice(a.triggeredPrice)}` : coin ? `Now ${formatPrice(coin.current_price)}` : ""}</small>
                      <small>Created {formatDateTime(a.createdAt)}</small>
                    </div>
                    <div className="row-actions">
                      {a.triggered
                        ? <button type="button" className="btn btn-sm" onClick={() => { setAlertActive(a.id, true); toast.success("Alert re-armed."); }}>Re-arm</button>
                        : <Toggle checked={a.active} onChange={(v) => setAlertActive(a.id, v)} label={`${a.active ? "Pause" : "Resume"} alert for ${a.name ?? a.coinId}`} />}
                      <button type="button" className="icon-btn" onClick={() => setForm(a)} aria-label="Edit alert"><Icon name="edit" size={15} /></button>
                      <button type="button" className="icon-btn" onClick={() => setDel(a)} aria-label="Delete alert"><Icon name="trash" size={15} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {form && <AlertForm initial={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {del && <ConfirmModal title="Delete this alert?" body={`${del.name ?? del.coinId}: ${describe(del)}`} confirmLabel="Delete" danger onClose={() => setDel(null)}
        onConfirm={() => { removeAlert(del.id); setDel(null); toast.success("Alert deleted."); }} />}
    </>
  );
}

export { AlertForm };
