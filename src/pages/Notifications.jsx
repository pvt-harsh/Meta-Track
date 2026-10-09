import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationItem } from "../components/NotificationMenu";
import { EmptyState, PageHeader, Segmented } from "../components/ui";
import { useStore } from "../context/StoreContext";
import { useDocumentTitle } from "../hooks";

export default function Notifications() {
  useDocumentTitle("Notifications");
  const { notifications, unread, markRead, markAllRead, dismissNotification, clearNotifications } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const list = notifications.filter((n) => tab === "all" || (tab === "unread" ? !n.read : n.type === tab));

  function open(n) { markRead(n.id); if (n.link) navigate(n.link); }

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications" description="Price alerts, watchlist moves and system messages."
        actions={<>
          <button type="button" className="btn" onClick={markAllRead} disabled={!unread}>Mark all read</button>
          <button type="button" className="btn" onClick={clearNotifications} disabled={!notifications.length}>Clear all</button>
        </>} />
      <div className="toolbar">
        <Segmented size="sm" label="Filter" value={tab} onChange={setTab}
          options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread ${unread}` }, { value: "alert", label: "Alerts" }, { value: "watchlist", label: "Watchlist" }, { value: "system", label: "System" }]} />
      </div>
      {list.length === 0 ? (
        <EmptyState icon="bell" title={notifications.length ? "Nothing in this view" : "You're all caught up"} description={notifications.length ? "Try another filter." : "When an alert fires or a watched asset moves sharply, it will appear here."} />
      ) : (
        <div className="card notif-page">{list.map((n) => <NotificationItem key={n.id} n={n} onOpen={open} onDismiss={dismissNotification} />)}</div>
      )}
    </>
  );
}
