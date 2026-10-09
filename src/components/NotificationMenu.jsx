import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import useDropdown from "./useDropdown";
import { useStore } from "../context/StoreContext";
import { timeAgo } from "../lib/format";

export const NOTIF_ICON = { alert: "bell", watchlist: "star", portfolio: "portfolio", system: "info", security: "shield" };

export function NotificationItem({ n, onOpen, onDismiss }) {
  return (
    <div className={`notif ${n.read ? "" : "unread"}`}>
      <button type="button" className="notif-main" onClick={() => onOpen(n)}>
        <span className={`notif-icon notif-${n.type}`}><Icon name={NOTIF_ICON[n.type] ?? "info"} size={16} /></span>
        <span className="notif-text">
          <b>{n.title}</b>
          {n.body && <span>{n.body}</span>}
          <small>{timeAgo(n.createdAt)}</small>
        </span>
        {!n.read && <i className="notif-dot" aria-label="Unread" />}
      </button>
      {onDismiss && (
        <button type="button" className="icon-btn notif-x" onClick={() => onDismiss(n.id)} aria-label={`Dismiss notification: ${n.title}`}><Icon name="close" size={13} /></button>
      )}
    </div>
  );
}

export default function NotificationMenu() {
  const { open, setOpen, root } = useDropdown();
  const { notifications, unread, markRead, markAllRead, dismissNotification } = useStore();
  const navigate = useNavigate();

  function openItem(n) {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="menu-root" ref={root}>
      <button type="button" className="icon-btn icon-btn-lg" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications">
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="dropdown notif-panel" role="dialog" aria-label="Notifications">
          <div className="dropdown-head">
            <b>Notifications</b>
            <button type="button" className="link-btn" onClick={markAllRead} disabled={!unread}>Mark all read</button>
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty"><Icon name="bell" size={20} /><b>You're all caught up</b><span>Price alerts and watchlist moves will show up here.</span></div>
            ) : (
              notifications.slice(0, 8).map((n) => <NotificationItem key={n.id} n={n} onOpen={openItem} onDismiss={dismissNotification} />)
            )}
          </div>
          <button type="button" className="dropdown-foot" onClick={() => { setOpen(false); navigate("/notifications"); }}>
            View all notifications <Icon name="arrowRight" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
