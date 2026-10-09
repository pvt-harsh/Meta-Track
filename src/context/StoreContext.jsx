import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";
import { formatPercent, formatPrice } from "../lib/format";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";
import { useSettings } from "./SettingsContext";
import { useToast } from "./ToastContext";

const Ctx = createContext(null);
const MAX_NOTIFICATIONS = 100;
const MAX_ACTIVITY = 60;
export const MAX_COMPARE = 4;

const GUEST_KEY = "metatrack:user:guest";
const EMPTY = { watchlist: [], portfolio: [], alerts: [], notifications: [], activity: [], compare: [], seenMoves: {} };

function loadFor(uid) {
  const raw = readStorage(`metatrack:user:${uid}`, {});
  return { ...EMPTY, ...raw };
}

const uid8 = () => crypto.randomUUID();

export function StoreProvider({ children }) {
  const { user, displayName } = useAuth();
  const { coins, byId, loading: dataLoading } = useData();
  const { settings } = useSettings();
  const toast = useToast();
  const userId = user?.id ?? "guest";
  const signedIn = Boolean(user?.id);
  const mergeAsked = useRef(null);

  const [data, setData] = useState(EMPTY);
  const [hydratedFor, setHydratedFor] = useState(null);
  const dataRef = useRef(EMPTY);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    if (!userId) { setData(EMPTY); setHydratedFor(null); return; }
    const loaded = loadFor(userId);
    if (!readStorage(`metatrack:user:${userId}`, null)) {
      loaded.notifications = [{
        id: uid8(), type: "system", title: "Welcome to MetaTrack",
        body: "Star coins to build a watchlist and set price alerts. Alerts are checked while MetaTrack is open.",
        link: "/markets", createdAt: new Date().toISOString(), read: false,
      }];
    }
    setData(loaded);
    setHydratedFor(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId || hydratedFor !== userId) return;
    writeStorage(`metatrack:user:${userId}`, data);
  }, [data, userId, hydratedFor]);

  const patch = useCallback((fn) => setData((d) => ({ ...d, ...fn(d) })), []);

  const log = useCallback((text, link) => ({
    id: uid8(), text, link, at: new Date().toISOString(),
  }), []);
  const withActivity = (d, entry) => [entry, ...d.activity].slice(0, MAX_ACTIVITY);

  const notify = useCallback((n) => {
    patch((d) => ({
      notifications: [{ id: uid8(), read: false, createdAt: new Date().toISOString(), ...n }, ...d.notifications].slice(0, MAX_NOTIFICATIONS),
    }));
  }, [patch]);

  const toggleWatch = useCallback((coinId, name) => {
    const had = dataRef.current.watchlist.includes(coinId);
    patch((d) => ({
      watchlist: had ? d.watchlist.filter((x) => x !== coinId) : [coinId, ...d.watchlist],
      activity: withActivity(d, log(`${had ? "Removed" : "Added"} ${name ?? coinId} ${had ? "from" : "to"} watchlist`, "/watchlist")),
    }));
    return !had;
  }, [patch, log]);

  const toggleCompare = useCallback((coinId) => {
    const cur = dataRef.current.compare;
    if (cur.includes(coinId)) { patch((d) => ({ compare: d.compare.filter((x) => x !== coinId) })); return "removed"; }
    if (cur.length >= MAX_COMPARE) { toast.toast(`You can compare up to ${MAX_COMPARE} assets.`); return "full"; }
    patch((d) => ({ compare: [...d.compare, coinId] }));
    return "added";
  }, [patch, toast]);
  const clearCompare = useCallback(() => patch(() => ({ compare: [] })), [patch]);

  const addHolding = useCallback((h) => {
    const entry = { id: uid8(), createdAt: new Date().toISOString(), ...h };
    patch((d) => ({
      portfolio: [entry, ...d.portfolio],
      activity: withActivity(d, log(`Added ${h.quantity} ${h.symbol ?? ""} to portfolio`.replace("  ", " "), "/portfolio")),
    }));
  }, [patch, log]);
  const editHolding = useCallback((id, changes) => {
    patch((d) => ({ portfolio: d.portfolio.map((p) => (p.id === id ? { ...p, ...changes } : p)), activity: withActivity(d, log("Updated a portfolio holding", "/portfolio")) }));
  }, [patch, log]);
  const removeHolding = useCallback((id) => {
    patch((d) => ({ portfolio: d.portfolio.filter((p) => p.id !== id), activity: withActivity(d, log("Removed a portfolio holding", "/portfolio")) }));
  }, [patch, log]);

  const addAlert = useCallback((a) => {
    patch((d) => ({
      alerts: [{ id: uid8(), active: true, triggered: false, createdAt: new Date().toISOString(), ...a }, ...d.alerts],
      activity: withActivity(d, log(`Created a price alert for ${a.name ?? a.coinId}`, "/alerts")),
    }));
  }, [patch, log]);
  const editAlert = useCallback((id, changes) => {
    patch((d) => ({ alerts: d.alerts.map((x) => (x.id === id ? { ...x, ...changes, triggered: false, triggeredAt: null } : x)) }));
  }, [patch]);
  const setAlertActive = useCallback((id, active) => {
    patch((d) => ({ alerts: d.alerts.map((x) => (x.id === id ? { ...x, active, triggered: active ? false : x.triggered } : x)) }));
  }, [patch]);
  const removeAlert = useCallback((id) => {
    patch((d) => ({ alerts: d.alerts.filter((x) => x.id !== id) }));
  }, [patch]);

  const markRead = useCallback((id) => patch((d) => ({ notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })), [patch]);
  const markAllRead = useCallback(() => patch((d) => ({ notifications: d.notifications.map((n) => ({ ...n, read: true })) })), [patch]);
  const dismissNotification = useCallback((id) => patch((d) => ({ notifications: d.notifications.filter((n) => n.id !== id) })), [patch]);
  const clearNotifications = useCallback(() => patch(() => ({ notifications: [] })), [patch]);

  useEffect(() => {
    if (!userId || hydratedFor !== userId || dataLoading || coins.length === 0) return;
    const cur = dataRef.current;
    const newNotifs = [];
    let alertsChanged = false;

    const alerts = cur.alerts.map((a) => {
      if (!a.active || a.triggered) return a;
      const coin = byId.get(a.coinId);
      if (!coin) return a;
      const price = Number(coin.current_price);
      const change = Number(coin.price_change_percentage_24h);
      let hit = false;
      let body = "";
      if (a.type === "above" && price >= a.target) { hit = true; body = `${coin.name} reached ${formatPrice(price)}, above your target of ${formatPrice(a.target)}.`; }
      if (a.type === "below" && price <= a.target) { hit = true; body = `${coin.name} fell to ${formatPrice(price)}, below your target of ${formatPrice(a.target)}.`; }
      if (a.type === "change" && Number.isFinite(change) && Math.abs(change) >= a.target) { hit = true; body = `${coin.name} moved ${formatPercent(change)} in 24h, past your ±${a.target}% threshold.`; }
      if (!hit) return a;
      alertsChanged = true;
      if (settings.notifyAlerts) {
        newNotifs.push({ id: uid8(), type: "alert", title: `${coin.symbol.toUpperCase()} alert triggered`, body, link: `/coin/${coin.id}`, createdAt: new Date().toISOString(), read: false });
      }
      return { ...a, triggered: true, active: false, triggeredAt: new Date().toISOString(), triggeredPrice: price };
    });

    const day = new Date().toISOString().slice(0, 10);
    const seen = { ...cur.seenMoves };
    let seenChanged = false;
    for (const key of Object.keys(seen)) if (!key.endsWith(day)) { delete seen[key]; seenChanged = true; }
    if (settings.notifyWatchlist) {
      for (const id of cur.watchlist) {
        const coin = byId.get(id);
        const change = Number(coin?.price_change_percentage_24h);
        const key = `${id}:${day}`;
        if (coin && Number.isFinite(change) && Math.abs(change) >= settings.watchlistThreshold && !seen[key]) {
          seen[key] = true; seenChanged = true;
          newNotifs.push({ id: uid8(), type: "watchlist", title: `${coin.name} ${change > 0 ? "is up" : "is down"} ${formatPercent(Math.abs(change), 1, false)}`, body: `${coin.symbol.toUpperCase()} is at ${formatPrice(coin.current_price)} on your watchlist.`, link: `/coin/${coin.id}`, createdAt: new Date().toISOString(), read: false });
        }
      }
    }

    if (alertsChanged || newNotifs.length || seenChanged) {
      const next = {
        ...cur,
        alerts: alertsChanged ? alerts : cur.alerts,
        notifications: [...newNotifs, ...cur.notifications].slice(0, MAX_NOTIFICATIONS),
        seenMoves: seen,
      };
      dataRef.current = next;
      setData(next);
      newNotifs.filter((n) => n.type === "alert").forEach((n) => toast.toast(n.title, { tone: "success" }));
    }
  }, [coins, byId, data.alerts, data.watchlist, userId, hydratedFor, dataLoading, settings.notifyAlerts, settings.notifyWatchlist, settings.watchlistThreshold, toast]);

  const mergeGuest = useCallback(() => {
    const g = readStorage(GUEST_KEY, null);
    if (!g) return;
    const uniq = (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])];
    patch((d) => ({
      watchlist: uniq(d.watchlist, g.watchlist),
      compare: uniq(d.compare, g.compare).slice(0, MAX_COMPARE),
      portfolio: [...d.portfolio, ...(g.portfolio ?? []).filter((p) => !d.portfolio.some((x) => x.id === p.id))],
      alerts: [...d.alerts, ...(g.alerts ?? []).filter((a) => !d.alerts.some((x) => x.id === a.id))],
      activity: withActivity(d, log("Merged your guest data into this account", "/watchlist")),
    }));
    writeStorage(GUEST_KEY, EMPTY);
    toast.success("Guest data merged into your account.");
  }, [patch, log, toast]);

  useEffect(() => {
    if (!signedIn || hydratedFor !== userId || mergeAsked.current === userId) return;
    mergeAsked.current = userId;
    const g = readStorage(GUEST_KEY, null);
    const n = (g?.watchlist?.length ?? 0) + (g?.portfolio?.length ?? 0) + (g?.alerts?.length ?? 0);
    if (n > 0) toast.toast(`You have ${n} saved item${n === 1 ? "" : "s"} from guest mode. Bring them into your account?`, { duration: 14000, action: { label: "Merge", onClick: mergeGuest } });
  }, [signedIn, hydratedFor, userId, mergeGuest, toast]);

  const exportData = useCallback(() => ({
    app: "MetaTrack", version: 2, exportedAt: new Date().toISOString(),
    account: { name: displayName },
    watchlist: data.watchlist, portfolio: data.portfolio, alerts: data.alerts,
    notifications: data.notifications, compare: data.compare, activity: data.activity,
    settings,
  }), [data, displayName, settings]);

  const importData = useCallback((json) => {
    if (!json || json.app !== "MetaTrack") throw new Error("This doesn't look like a MetaTrack export.");
    const arr = (v) => (Array.isArray(v) ? v : []);
    const ok = (o) => o && typeof o === "object";
    patch((d) => ({
      watchlist: arr(json.watchlist).filter((x) => typeof x === "string").slice(0, 500),
      portfolio: arr(json.portfolio).filter((p) => ok(p) && typeof p.coinId === "string" && Number(p.quantity) > 0 && Number(p.buyPriceUsd) >= 0).map((p) => ({ ...p, id: p.id || uid8() })),
      alerts: arr(json.alerts).filter((a) => ok(a) && typeof a.coinId === "string" && ["above", "below", "change"].includes(a.type) && Number(a.target) > 0).map((a) => ({ ...a, id: a.id || uid8() })),
      notifications: d.notifications,
      activity: withActivity(d, log("Imported data from a MetaTrack export", "/account")),
    }));
  }, [patch, log]);

  const resetAll = useCallback(() => setData({ ...EMPTY }), []);

  const isGuest = !signedIn;
  const unread = data.notifications.filter((n) => !n.read).length;
  const activeAlerts = data.alerts.filter((a) => a.active && !a.triggered).length;

  const value = useMemo(() => ({
    ...data, unread, activeAlerts, isGuest,
    toggleWatch, toggleCompare, clearCompare,
    addHolding, editHolding, removeHolding,
    addAlert, editAlert, setAlertActive, removeAlert,
    notify, markRead, markAllRead, dismissNotification, clearNotifications,
    exportData, importData, resetAll, mergeGuest,
  }), [data, unread, activeAlerts, isGuest, mergeGuest, toggleWatch, toggleCompare, clearCompare, addHolding, editHolding, removeHolding, addAlert, editAlert, setAlertActive, removeAlert, notify, markRead, markAllRead, dismissNotification, clearNotifications, exportData, importData, resetAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
