import { useCallback, useEffect, useState } from "react";
import { getCoinChart } from "./services/cryptoApi";
import { useStore } from "./context/StoreContext";
import { useToast } from "./context/ToastContext";

export function useChart(coinId, range) {
  const [state, setState] = useState({ points: [], loading: true, error: false });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!coinId) { setState({ points: [], loading: false, error: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    getCoinChart(coinId, range)
      .then((d) => { if (!cancelled) setState({ points: Array.isArray(d?.prices) ? d.prices : [], loading: false, error: false }); })
      .catch(() => { if (!cancelled) setState({ points: [], loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [coinId, range, nonce]);
  return { ...state, retry: useCallback(() => setNonce((n) => n + 1), []) };
}

export function useCoinActions() {
  const store = useStore();
  const toast = useToast();
  const onWatch = useCallback((coin) => {
    const added = store.toggleWatch(coin.id, coin.name);
    toast.toast(added ? `${coin.name} added to your watchlist.` : `${coin.name} removed from your watchlist.`, {
      action: { label: "Undo", onClick: () => store.toggleWatch(coin.id, coin.name) },
    });
  }, [store, toast]);
  const onCompare = useCallback((coin) => {
    const r = store.toggleCompare(coin.id);
    if (r === "added") toast.toast(`${coin.name} added to Compare.`);
  }, [store, toast]);
  return { onWatch, onCompare, watchlist: store.watchlist, compare: store.compare };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · MetaTrack` : "MetaTrack — Crypto market tracker";
  }, [title]);
}

export function periodChange(points) {
  if (!points || points.length < 2 || !points[0][1]) return null;
  return ((points[points.length - 1][1] - points[0][1]) / points[0][1]) * 100;
}
