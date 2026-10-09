import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import Avatar from "./Avatar";
import useDropdown from "./useDropdown";
import { Segmented } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";

export default function UserMenu({ onOpenShortcuts }) {
  const { open, setOpen, root } = useDropdown();
  const { displayName, email, avatarUrl, provider, signOut, isGuest, requireAuth, loading } = useAuth();
  const { settings, update } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const go = (to) => () => { setOpen(false); navigate(to); };

  async function logout() {
    setOpen(false);
    try { await signOut(); } catch (e) { toast.error(e.message); }
  }

  const items = [
    { icon: "grid", label: "Dashboard", hint: "Your activity & summary", onClick: go("/account") },
    { icon: "user", label: "Profile & security", hint: "Name, photo, password", onClick: go("/account#profile") },
    { icon: "settings", label: "Settings", hint: "Region, alerts, appearance", onClick: go("/settings") },
    { icon: "bell", label: "Notifications", hint: "Everything you've received", onClick: go("/notifications") },
    { icon: "keyboard", label: "Keyboard shortcuts", hint: "Press ? anywhere", onClick: () => { setOpen(false); onOpenShortcuts(); } },
    { icon: "help", label: "Help & privacy", hint: "Support, data handling", onClick: go("/settings?section=support") },
  ];

  if (isGuest) {
    return (
      <div className="guest-actions">
        <button type="button" className="btn btn-sm hide-sm" onClick={() => navigate("/login")} disabled={loading}>Sign in</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => requireAuth("open")} disabled={loading}>Get started</button>
      </div>
    );
  }

  return (
    <div className="menu-root" ref={root}>
      <button type="button" className={`user-trigger ${open ? "open" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Avatar url={avatarUrl} name={displayName} email={email} size={30} />
        <span className="user-trigger-name">{displayName}</span>
        <Icon name="chevron" size={15} className="user-trigger-chev" />
      </button>
      {open && (
        <div className="dropdown user-panel" role="menu" aria-label="Account menu">
          <div className="user-panel-head">
            <Avatar url={avatarUrl} name={displayName} email={email} size={44} />
            <div>
              <b>{displayName}</b>
              <span title={email}>{email}</span>
              <small>Signed in with {provider === "email" ? "email" : provider[0].toUpperCase() + provider.slice(1)}</small>
            </div>
          </div>
          <div className="menu-appearance">
            <span>Appearance</span>
            <Segmented size="sm" label="Theme" value={settings.theme} onChange={(theme) => update({ theme })}
              options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Auto" }]} />
          </div>
          <div className="menu-items">
            {items.map((it) => (
              <button key={it.label} type="button" role="menuitem" className="menu-item" onClick={it.onClick}>
                <span className="menu-item-icon"><Icon name={it.icon} size={16} /></span>
                <span className="menu-item-text"><b>{it.label}</b><small>{it.hint}</small></span>
              </button>
            ))}
          </div>
          <button type="button" role="menuitem" className="menu-item menu-logout" onClick={logout}>
            <span className="menu-item-icon"><Icon name="logout" size={16} /></span>
            <span className="menu-item-text"><b>Sign out</b></span>
          </button>
        </div>
      )}
    </div>
  );
}
