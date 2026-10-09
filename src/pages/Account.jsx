import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import CoinLogo from "../components/CoinLogo";
import { Pct } from "../components/CoinTable";
import { Field, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useStore } from "../context/StoreContext";
import { useToast } from "../context/ToastContext";
import { ACCOUNT_UNLOCKS } from "../lib/features";
import { fileToAvatar } from "../lib/image";
import { formatDate, formatDateTime, formatMoney, formatPercent, formatPrice, timeAgo, tone } from "../lib/format";
import { useDocumentTitle } from "../hooks";
import { NOTIF_ICON } from "../components/NotificationMenu";

const providerName = (p) => (p === "email" ? "Email & password" : p[0].toUpperCase() + p.slice(1));

function AccountInner() {
  useDocumentTitle("Account");
  const auth = useAuth();
  const { user, displayName, email, avatarUrl, provider } = auth;
  const { byId, fmtKey } = useData();
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const fileRef = useRef(null);

  const [name, setName] = useState(displayName);
  const [nameErr, setNameErr] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwErr, setPwErr] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => setName(displayName), [displayName]);
  useEffect(() => { if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [hash]);

  const portfolio = useMemo(() => {
    let value = 0, cost = 0;
    for (const h of store.portfolio) { const c = byId.get(h.coinId); if (c) { value += h.quantity * c.current_price; cost += h.quantity * h.buyPriceUsd; } }
    return { value, cost, pct: cost ? ((value - cost) / cost) * 100 : null, count: store.portfolio.length };
  }, [store.portfolio, byId]);
  const favorites = store.watchlist.map((id) => byId.get(id)).filter(Boolean).slice(0, 5);
  const nextAlerts = store.alerts.filter((a) => a.active && !a.triggered).slice(0, 3);

  async function saveName(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setNameErr("Enter a display name.");
    if (n.length > 60) return setNameErr("Keep it to 60 characters or fewer.");
    setNameErr(""); setSavingName(true);
    try { await auth.updateProfile({ display_name: n }); toast.success("Name updated."); } catch (err) { setNameErr(err.message); }
    setSavingName(false);
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusyAvatar(true);
    try { await auth.updateProfile({ avatar_url: await fileToAvatar(file) }); toast.success("Profile photo updated."); } catch (err) { toast.error(err.message); }
    setBusyAvatar(false);
  }

  async function removeAvatar() {
    setBusyAvatar(true);
    try { await auth.updateProfile({ avatar_url: null }); toast.success("Profile photo removed."); } catch (err) { toast.error(err.message); }
    setBusyAvatar(false);
  }

  async function changePw(e) {
    e.preventDefault();
    if (pw.next.length < 8) return setPwErr("Use at least 8 characters.");
    if (pw.next !== pw.confirm) return setPwErr("The two passwords don't match.");
    setPwErr(""); setSavingPw(true);
    try {
      await auth.updatePassword(pw.next);
      setPw({ next: "", confirm: "" });
      toast.success("Password updated.");
      store.notify({ type: "security", title: "Password changed", body: "Your account password was updated.", link: "/account#security" });
    } catch (err) { setPwErr(err.message); }
    setSavingPw(false);
  }

  const hasCustomAvatar = Boolean(auth.profile?.avatar_url);

  return (
    <div data-fmt={fmtKey}>
      <PageHeader eyebrow="Your account" title="Dashboard" description="A summary of your MetaTrack activity, plus your profile and security." />

      <section className="card profile-hero">
        <Avatar url={avatarUrl} name={displayName} email={email} size={72} />
        <div className="profile-hero-text">
          <h2>{displayName}</h2>
          <span>{email}</span>
          <div className="chips-static">
            <span className="pill"><Icon name="shield" size={13} /> {providerName(provider)}</span>
            <span className="pill status-active-pill"><i /> Active</span>
            {user?.email_confirmed_at && <span className="pill">Email verified</span>}
          </div>
        </div>
        <dl className="profile-dates">
          <div><dt>Member since</dt><dd>{formatDate(user?.created_at)}</dd></div>
          <div><dt>Last sign-in</dt><dd>{formatDateTime(user?.last_sign_in_at)}</dd></div>
        </dl>
      </section>

      <div className="grid-dash">
        <section className="card dash-card">
          <div className="card-head"><div><span className="eyebrow">Portfolio</span><h2>{portfolio.count ? formatMoney(portfolio.value) : "No holdings"}</h2></div><Link to="/portfolio" className="link-btn">Open</Link></div>
          {portfolio.count ? <p className={`pct-${tone(portfolio.pct)}`}>{formatPercent(portfolio.pct)} <span className="muted small">vs. {formatMoney(portfolio.cost)} invested</span></p> : <p className="muted small">Add what you own to track value and profit.</p>}
        </section>
        <section className="card dash-card">
          <div className="card-head"><div><span className="eyebrow">Alerts</span><h2>{store.activeAlerts} active</h2></div><Link to="/alerts" className="link-btn">Manage</Link></div>
          {nextAlerts.length ? <ul className="mini-list plain">{nextAlerts.map((a) => <li key={a.id}><span><b>{a.symbol ?? a.coinId}</b> <span className="muted small">{a.type === "change" ? `±${a.target}% / 24h` : `${a.type === "above" ? "≥" : "≤"} ${formatPrice(a.target)}`}</span></span></li>)}</ul> : <p className="muted small">No alerts are watching prices right now.</p>}
        </section>
        <section className="card dash-card">
          <div className="card-head"><div><span className="eyebrow">Notifications</span><h2>{store.unread} unread</h2></div><Link to="/notifications" className="link-btn">Inbox</Link></div>
          {store.notifications.length ? <ul className="mini-list plain">{store.notifications.slice(0, 3).map((n) => <li key={n.id}><button type="button" onClick={() => { store.markRead(n.id); navigate(n.link ?? "/notifications"); }}><Icon name={NOTIF_ICON[n.type] ?? "info"} size={14} /><span className="clip">{n.title}</span><small className="muted">{timeAgo(n.createdAt)}</small></button></li>)}</ul> : <p className="muted small">You're all caught up.</p>}
        </section>
        <section className="card dash-card">
          <div className="card-head"><div><span className="eyebrow">Favourite assets</span><h2>{store.watchlist.length} watched</h2></div><Link to="/watchlist" className="link-btn">Open</Link></div>
          {favorites.length ? <ul className="mini-list">{favorites.map((c) => <li key={c.id}><button type="button" onClick={() => navigate(`/coin/${c.id}`)}><CoinLogo coin={c} size={22} /><b>{c.symbol.toUpperCase()}</b><span>{formatPrice(c.current_price)}</span><Pct value={c.price_change_percentage_24h} /></button></li>)}</ul> : <p className="muted small">Star assets in Markets to see them here.</p>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Account activity</span><h2>Recent activity</h2></div></div>
        {store.activity.length === 0 ? <p className="muted small">Your changes to the watchlist, portfolio and alerts will be logged here.</p> : (
          <ul className="activity">{store.activity.slice(0, 10).map((a) => <li key={a.id}><button type="button" className="activity-link" onClick={() => a.link && navigate(a.link)}>{a.text}</button><small>{timeAgo(a.at)}</small></li>)}</ul>
        )}
      </section>

      <section className="card" id="profile">
        <div className="card-head"><div><span className="eyebrow">Profile</span><h2>Name & photo</h2></div></div>
        <div className="profile-edit">
          <div className="avatar-edit">
            <Avatar url={avatarUrl} name={displayName} email={email} size={88} />
            <div className="avatar-actions">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busyAvatar}><Icon name="camera" size={14} />{busyAvatar ? "Working…" : avatarUrl ? "Change photo" : "Upload photo"}</button>
              {hasCustomAvatar && <button type="button" className="btn btn-sm" onClick={removeAvatar} disabled={busyAvatar}>Remove</button>}
            </div>
          </div>
          <form onSubmit={saveName} noValidate className="name-form">
            <Field label="Display name" htmlFor="display-name" error={nameErr}><input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></Field>
            <Field label="Email" htmlFor="email-ro" hint={provider === "email" ? "Your sign-in email." : `Managed by ${providerName(provider)}.`}><input id="email-ro" value={email} readOnly /></Field>
            <button type="submit" className="btn btn-primary" disabled={savingName || name.trim() === displayName}>{savingName ? "Saving…" : "Save changes"}</button>
          </form>
        </div>
      </section>

      <section className="card" id="security">
        <div className="card-head"><div><span className="eyebrow">Security</span><h2>Sign-in & password</h2></div></div>
        {provider === "email" ? (
          <form onSubmit={changePw} noValidate className="pw-form">
            <Field label="New password" htmlFor="pw-new" hint="At least 8 characters."><input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} /></Field>
            <Field label="Confirm new password" htmlFor="pw-confirm" error={pwErr}><input id="pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} /></Field>
            <button type="submit" className="btn btn-primary" disabled={savingPw || !pw.next}>{savingPw ? "Updating…" : "Update password"}</button>
          </form>
        ) : <p className="muted">You sign in with {providerName(provider)}, so your password is managed there. MetaTrack never sees it.</p>}
        <div className="security-row">
          <div><b>Sign out of this device</b><p className="muted small">Ends your session on this browser.</p></div>
          <button type="button" className="btn" onClick={() => auth.signOut().catch((e) => toast.error(e.message))}><Icon name="logout" size={15} />Sign out</button>
        </div>
      </section>
    </div>
  );
}

function GuestAccount() {
  const { requireAuth } = useAuth();
  return (
    <>
      <PageHeader eyebrow="Your account" title="You're browsing as a guest" description="Everything on MetaTrack works without an account. Create a free one to unlock the rest." />
      <section className="card guest-card">
        <div>
          <h2>What an account unlocks</h2>
          <ul className="auth-unlocks">{ACCOUNT_UNLOCKS.map((u) => <li key={u}><Icon name="check" size={14} />{u}</li>)}</ul>
        </div>
        <div className="guest-card-cta">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => requireAuth("account")}>Sign in / Create account</button>
          <small className="muted">Your guest watchlist can be merged into your account when you sign in.</small>
        </div>
      </section>
    </>
  );
}

export default function Account() {
  const { user } = useAuth();
  return user ? <AccountInner /> : <GuestAccount />;
}
