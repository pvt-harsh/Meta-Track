import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import { ConfirmModal, Field, Modal, PageHeader, Segmented, Toggle } from "../components/ui";
import { COVERAGE, PAGE_SIZES, RANGES, useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { useToast } from "../context/ToastContext";
import { CURRENCIES, DATE_FORMATS, NUMBER_FORMATS, REGIONS, TIMEZONES, formatDateTime, formatPrice } from "../lib/format";
import { SHORTCUTS } from "../components/nav";
import { useDocumentTitle } from "../hooks";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: "sun" },
  { id: "region", label: "Language & region", icon: "globe" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "markets", label: "Markets", icon: "markets" },
  { id: "application", label: "Application", icon: "keyboard" },
  { id: "privacy", label: "Data & privacy", icon: "shield" },
  { id: "support", label: "Support", icon: "help" },
  { id: "danger", label: "Danger zone", icon: "alert" },
];

function Row({ title, desc, children, stack }) {
  return (
    <div className={`s-row ${stack ? "stack" : ""}`}>
      <div className="s-row-text"><b>{title}</b>{desc && <p>{desc}</p>}</div>
      <div className="s-row-control">{children}</div>
    </div>
  );
}

function Select({ id, value, onChange, options, label }) {
  return (
    <select id={id} className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function Settings() {
  useDocumentTitle("Settings");
  const { settings, update, applyRegion, reset } = useSettings();
  const { importData } = useStore();
  const { deleteAccount, displayName, email, isGuest, requireAuth } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.id === params.get("section")) ? params.get("section") : "appearance";
  const fileRef = useRef(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) return toast.error("That file is too large to be a MetaTrack export.");
    try {
      importData(JSON.parse(await file.text()));
      toast.success("Data imported. Your watchlist, portfolio and alerts were replaced.");
    } catch (err) {
      toast.error(err instanceof SyntaxError ? "That file isn't valid JSON." : err.message);
    }
  }

  async function doDelete() {
    setBusy(true);
    try { await deleteAccount(); } catch (err) { toast.error(err.message); setBusy(false); setDelOpen(false); }
  }

  const now = new Date();
  const opt = (arr, v = "id", l = "label") => arr.map((x) => ({ value: x[v] ?? x.code, label: x[l] }));

  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" description="Appearance, regional formats, alerts and your data." />
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.filter((x) => !(isGuest && x.id === "danger")).map((s) => (
            <button key={s.id} type="button" className={section === s.id ? "active" : ""} aria-current={section === s.id ? "page" : undefined} onClick={() => setParams({ section: s.id }, { replace: true })}>
              <Icon name={s.icon} size={16} /><span>{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {section === "appearance" && (
            <section className="card s-card">
              <h2>Appearance</h2>
              <Row title="Theme" desc="Auto follows your device setting."><Segmented label="Theme" value={settings.theme} onChange={(theme) => update({ theme })} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Auto" }]} /></Row>
              <Row title="Sparklines" desc="Show a 7-day trend line in market tables."><Toggle label="Sparklines" checked={settings.showSparklines} onChange={(v) => update({ showSparklines: v })} /></Row>
              <Row title="Price ticker" desc="Scrolling strip of top assets under the top bar."><Toggle label="Price ticker" checked={settings.showTicker} onChange={(v) => update({ showTicker: v })} /></Row>
              <Row title="Motion" desc="Reduce animations and transitions across the app."><Segmented label="Motion" value={settings.motion} onChange={(motion) => update({ motion })} options={[{ value: "system", label: "System" }, { value: "reduced", label: "Reduced" }, { value: "full", label: "Full" }]} /></Row>
            </section>
          )}

          {section === "region" && (
            <section className="card s-card">
              <h2>Language & region</h2>
              <Row title="Language" desc="MetaTrack is currently available in English only."><span className="pill">English</span></Row>
              <Row title="Region preset" desc="Sets currency, number, date and time conventions in one step.">
                <Select label="Region preset" value="" onChange={(v) => v && (applyRegion(v), toast.success("Regional formats applied."))} options={[{ value: "", label: "Choose a region…" }, ...REGIONS.map((r) => ({ value: r.id, label: r.label }))]} />
              </Row>
              <Row title="Currency" desc="Live exchange rates are applied to every price, portfolio value and alert.">
                <Select label="Currency" value={settings.currency} onChange={(currency) => update({ currency })} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.label} (${c.symbol})` }))} />
              </Row>
              <Row title="Number format" desc={`Example: ${formatPrice(1234567.89)}`}>
                <Select label="Number format" value={settings.numberFormat} onChange={(numberFormat) => update({ numberFormat })} options={NUMBER_FORMATS.map((n) => ({ value: n.id, label: `${n.label} — ${n.hint}` }))} />
              </Row>
              <Row title="Date format" desc={`Today: ${formatDateTime(now).split(",")[0]}`}>
                <Select label="Date format" value={settings.dateFormat} onChange={(dateFormat) => update({ dateFormat })} options={opt(DATE_FORMATS)} />
              </Row>
              <Row title="Time format"><Segmented label="Time format" value={settings.timeFormat} onChange={(timeFormat) => update({ timeFormat })} options={[{ value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} /></Row>
              <Row title="Timezone" desc={`Now: ${formatDateTime(now)}`}>
                <Select label="Timezone" value={settings.timezone} onChange={(timezone) => update({ timezone })} options={opt(TIMEZONES)} />
              </Row>
            </section>
          )}

          {section === "notifications" && (
            <section className="card s-card">
              <h2>Notifications</h2>
              <Row title="Price alerts" desc="Notify me when one of my alerts triggers."><Toggle label="Price alert notifications" checked={settings.notifyAlerts} onChange={(v) => update({ notifyAlerts: v })} /></Row>
              <Row title="Watchlist movement" desc="Notify me once a day when a watched asset makes a large move."><Toggle label="Watchlist notifications" checked={settings.notifyWatchlist} onChange={(v) => update({ notifyWatchlist: v })} /></Row>
              <Row title="Watchlist threshold" desc="A 24-hour move at least this large counts as a large move.">
                <Select label="Watchlist threshold" value={String(settings.watchlistThreshold)} onChange={(v) => update({ watchlistThreshold: Number(v) })} options={[3, 5, 8, 10, 15, 20].map((n) => ({ value: String(n), label: `±${n}%` }))} />
              </Row>
              <Row title="System messages" desc="Product and account messages."><Toggle label="System notifications" checked={settings.notifySystem} onChange={(v) => update({ notifySystem: v })} /></Row>
              <p className="muted small s-note">Notifications are generated in the app while it's open. Email and push notifications aren't available yet.</p>
            </section>
          )}

          {section === "markets" && (
            <section className="card s-card">
              <h2>Markets</h2>
              <Row title="Market coverage" desc="How many top assets are loaded. More coverage means more data requests."><Select label="Market coverage" value={String(settings.marketPages)} onChange={(v) => update({ marketPages: Number(v) })} options={COVERAGE.map(([p, l]) => ({ value: String(p), label: l }))} /></Row>
              <Row title="Rows per page" desc="Assets shown on each Markets page."><Segmented label="Rows per page" value={settings.pageSize} onChange={(pageSize) => update({ pageSize })} options={PAGE_SIZES} /></Row>
              <Row title="Default sorting" desc="How the Markets table is sorted when opened."><Select label="Default sorting" value={settings.defaultSort} onChange={(defaultSort) => update({ defaultSort })} options={[{ value: "rank", label: "Market cap rank" }, { value: "change", label: "24h change" }, { value: "volume", label: "24h volume" }, { value: "price", label: "Price" }]} /></Row>
              <Row title="Default chart range" desc="The timeframe charts open with."><Segmented label="Default chart range" value={settings.defaultRange} onChange={(defaultRange) => update({ defaultRange })} options={RANGES} /></Row>
              <Row title="Auto-refresh" desc="How often prices update and alerts are checked."><Select label="Auto-refresh" value={String(settings.refreshMs)} onChange={(v) => update({ refreshMs: Number(v) })} options={[{ value: "0", label: "Off (manual only)" }, { value: "30000", label: "Every 30 seconds" }, { value: "60000", label: "Every minute" }, { value: "120000", label: "Every 2 minutes" }, { value: "300000", label: "Every 5 minutes" }]} /></Row>
            </section>
          )}

          {section === "application" && (
            <section className="card s-card">
              <h2>Application</h2>
              <Row title="Keyboard shortcuts" desc="Single-key navigation like G then M. Ctrl/⌘ K always works."><Toggle label="Keyboard shortcuts" checked={settings.shortcuts} onChange={(v) => update({ shortcuts: v })} /></Row>
              <ul className="shortcut-list s-shortcuts">
                {SHORTCUTS.map((s) => <li key={s.label}><span>{s.label}</span><span className="shortcut-keys">{s.keys.map((k, i) => (k === "then" ? <em key={i}>then</em> : <kbd key={i}>{k}</kbd>))}</span></li>)}
              </ul>
              <Row title="Reset preferences" desc="Restore every setting on this page to its default. Your watchlist, portfolio and alerts are not affected."><button type="button" className="btn" onClick={() => setResetOpen(true)}>Reset preferences</button></Row>
            </section>
          )}

          {section === "privacy" && (
            <section className="card s-card">
              <h2>Data & privacy</h2>
              <Row title="Import data" desc="Restore from a MetaTrack export. This replaces your current watchlist, portfolio and alerts."><>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
                <button type="button" className="btn" onClick={() => requireAuth("backup") && fileRef.current?.click()}><Icon name="upload" size={15} />Import</button></>
              </Row>
              <div className="s-info">
                <h3>How your data is handled</h3>
                <ul>
                  <li>Your watchlist, portfolio, alerts and notifications are stored in this browser, tied to your account. They aren't uploaded to a server, so they don't sync across devices.</li>
                  <li>Your name, photo and sign-in details are stored with our authentication provider, Supabase.</li>
                  <li>Market data is fetched through MetaTrack's own server from CoinGecko. No personal data is sent with those requests.</li>
                </ul>
              </div>
            </section>
          )}

          {section === "support" && (
            <section className="card s-card">
              <h2>Support</h2>
              <Row title="Account & profile" desc={isGuest ? "You're using MetaTrack as a guest. Sign in to unlock portfolio, alerts and backups." : "Change your name, photo or password."}><button type="button" className="btn btn-primary" onClick={() => (isGuest ? requireAuth("account") : navigate("/account#profile"))}>{isGuest ? "Sign in / Create account" : "Open account"}</button></Row>
              <Row title="Contact the developer" desc="Questions, bug reports or feedback about MetaTrack."><a className="btn" href="https://www.instagram.com/_pvt.hash/" target="_blank" rel="noopener noreferrer">Instagram <Icon name="external" size={14} /></a></Row>
              
            </section>
          )}

          {section === "danger" && !isGuest && (
            <section className="card s-card danger-card">
              <h2>Danger zone</h2>
              <Row title="Delete account" desc="Permanently deletes your sign-in and profile. Data stored in this browser stays until you clear it. This can't be undone."><button type="button" className="btn btn-danger" onClick={() => setDelOpen(true)}>Delete account</button></Row>
            </section>
          )}
        </div>
      </div>

      {resetOpen && <ConfirmModal title="Reset preferences?" body="All settings return to their defaults." confirmLabel="Reset" onClose={() => setResetOpen(false)} onConfirm={() => { reset(); setResetOpen(false); toast.success("Preferences reset."); }} />}
      {delOpen && (
        <Modal title="Delete your account?" eyebrow="Danger zone" onClose={() => !busy && setDelOpen(false)}>
          <p className="modal-body">This permanently deletes the account for <b>{email || displayName}</b>. Type <b>DELETE</b> to confirm.</p>
          <Field label="Confirmation" htmlFor="del-confirm"><input id="del-confirm" value={delText} onChange={(e) => setDelText(e.target.value)} autoComplete="off" data-autofocus /></Field>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setDelOpen(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={delText !== "DELETE" || busy} onClick={doDelete}>{busy ? "Deleting…" : "Delete account"}</button></div>
        </Modal>
      )}
    </>
  );
}
