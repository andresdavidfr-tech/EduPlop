import { useState } from "react";
import { store, useStore } from "../lib/store";

const ICON: Record<string, string> = {
  pickup: "🚸", announcement: "📣", alert: "⚠️", message: "💬",
};

function timeAgo(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function NotificationsBell() {
  const state = useStore();
  const [open, setOpen] = useState(false);
  const user = store.currentUser();
  const items = store.notificationsFor(user);
  const unread = store.unreadCountFor(user);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) store.markAllRead(user);
  }

  return (
    <div className="bell-wrap">
      <button className="bell" onClick={toggle} title="Notificaciones">
        🔔{unread > 0 && <em className="badge">{unread}</em>}
      </button>
      {open && (
        <>
          <div className="bell-backdrop" onClick={() => setOpen(false)} />
          <div className="bell-panel">
            <header>Notificaciones</header>
            {items.length === 0 && <div className="muted small pad">Sin notificaciones.</div>}
            {items.map((n) => (
              <div key={n.id} className="notif">
                <span className="notif-icon">{ICON[n.kind] ?? "🔔"}</span>
                <div>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  <small className="muted">{timeAgo(n.timestamp)}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
