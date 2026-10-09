import { memo, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import Logo from "./Logo";
import Avatar from "./Avatar";
import CoinLogo from "./CoinLogo";
import UserMenu from "./UserMenu";
import NotificationMenu from "./NotificationMenu";
import { NAV_ITEMS } from "./nav";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useSettings } from "../context/SettingsContext";
import { formatPercent, formatPrice, timeAgo, tone } from "../lib/format";

export function Sidebar({ collapsed, setCollapsed }) {
  const { displayName, email, avatarUrl, isGuest, requireAuth } = useAuth();
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Primary">
      <div className="sidebar-head">
        <NavLink to="/dashboard" className="sidebar-brand" aria-label="MetaTrack home">
          <Logo size="md" showWordmark={!collapsed} />
        </NavLink>
        <button type="button" className="icon-btn sidebar-toggle" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          <Icon name={collapsed ? "chevronsRight" : "chevronsLeft"} size={15} />
        </button>
      </div>
      <nav className="side-nav">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`} data-tip={label} aria-label={label}>
            <Icon name={icon} size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
        <NavLink to="/" end className="side-link side-home" data-tip="Homepage" aria-label="Back to homepage">
          <Icon name="globe" size={18} />
          {!collapsed && <span>Homepage</span>}
        </NavLink>
      </nav>
      {isGuest ? (
        <button type="button" className="sidebar-user sidebar-guest" data-tip="Sign in" onClick={() => requireAuth("open")}>
          <Avatar name="Guest" size={32} />
          {!collapsed && <span className="sidebar-user-text"><b>Guest mode</b><small>Sign in to unlock more</small></span>}
        </button>
      ) : (
      <NavLink to="/account" className="sidebar-user" data-tip={displayName}>
        <Avatar url={avatarUrl} name={displayName} email={email} size={32} />
        {!collapsed && (
          <span className="sidebar-user-text"><b>{displayName}</b><small>Account & dashboard</small></span>
        )}
      </NavLink>
      )}
    </aside>
  );
}

export function MobileNav() {
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const main = NAV_ITEMS.filter((n) => ["/dashboard", "/markets", "/watchlist", "/portfolio", "/alerts"].includes(n.to));
  useEffect(() => setMore(false), [loc.pathname]);
  return (
    <>
      {more && (
        <div className="more-sheet" role="menu">
          {[...NAV_ITEMS.filter((n) => ["/heatmap", "/tools", "/compare", "/settings"].includes(n.to)), { to: "/notifications", label: "Notifications", icon: "bell" }, { to: "/account", label: "Account", icon: "user" }, { to: "/", label: "Homepage", icon: "globe" }].map((n) => (
            <NavLink key={n.to} to={n.to} role="menuitem" className="more-link"><Icon name={n.icon} size={18} />{n.label}</NavLink>
          ))}
        </div>
      )}
      <nav className="mobile-nav" aria-label="Primary">
        {main.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-link ${isActive ? "active" : ""}`}>
            <Icon name={icon} size={20} /><span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className={`mobile-link ${more ? "active" : ""}`} onClick={() => setMore((v) => !v)} aria-expanded={more}>
          <Icon name="grid" size={20} /><span>More</span>
        </button>
      </nav>
    </>
  );
}

export function Topbar({ onOpenPalette, onOpenShortcuts }) {
  const { refresh, refreshing, updatedAt } = useData();
  const { update } = useSettings();
  const dark = document.documentElement.dataset.theme !== "light";
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  return (
    <header className="topbar">
      <button type="button" className="command-search" onClick={onOpenPalette} aria-label="Search coins and pages">
        <Icon name="search" size={16} />
        <span>Search assets or jump to a page</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="topbar-actions">
        {updatedAt && <span className="updated-at hide-md" title="Time since market data was last updated">Updated {timeAgo(updatedAt)}</span>}
        <button type="button" className="icon-btn icon-btn-lg" onClick={() => refresh(true)} disabled={refreshing} aria-label="Refresh market data" title="Refresh market data">
          <Icon name="refresh" size={17} className={refreshing ? "spin" : ""} />
        </button>
        <button type="button" className="icon-btn icon-btn-lg" onClick={() => update({ theme: dark ? "light" : "dark" })} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
          <Icon name={dark ? "sun" : "moon"} size={17} />
        </button>
        <NotificationMenu />
        <UserMenu onOpenShortcuts={onOpenShortcuts} />
      </div>
    </header>
  );
}

export const TickerTape = memo(function TickerTape({ coins, fmtKey }) {
  const navigate = useNavigate();
  const items = coins.slice(0, 14);
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="ticker" aria-label="Top assets by market cap" data-fmt={fmtKey}>
      <div className="ticker-track">
        {doubled.map((c, i) => (
          <button key={`${c.id}-${i}`} type="button" className="ticker-item" onClick={() => navigate(`/coin/${c.id}`)} tabIndex={i >= items.length ? -1 : 0} aria-hidden={i >= items.length}>
            <CoinLogo coin={c} size={16} />
            <b>{c.symbol.toUpperCase()}</b>
            <span>{formatPrice(c.current_price)}</span>
            <em className={`pct-${tone(c.price_change_percentage_24h)}`}>{formatPercent(c.price_change_percentage_24h, 2)}</em>
          </button>
        ))}
      </div>
    </div>
  );
});
