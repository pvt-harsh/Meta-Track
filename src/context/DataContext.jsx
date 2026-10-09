import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearApiCache, getFxRates, getGlobalMarket, getMarkets, getTrending } from "../services/cryptoApi";
import { CURRENCIES, configureFormat } from "../lib/format";
import { useSettings } from "./SettingsContext";

const Ctx = createContext(null);

export function DataProvider({ children }) {
  const { settings } = useSettings();
  const [coins, setCoins] = useState([]);
  const [globalMarket, setGlobalMarket] = useState(null);
  const [trending, setTrending] = useState([]);
  const [rates, setRates] = useState({ usd: 1 });
  const [fxFailed, setFxFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const hasData = useRef(false);

  const rate = rates[settings.currency];
  const effectiveCurrency = rate ? settings.currency : "usd";
  const effectiveRate = rate ?? 1;

  configureFormat({
    currency: effectiveCurrency,
    rate: effectiveRate,
    numberFormat: settings.numberFormat,
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    timezone: settings.timezone,
  });
  const fmtKey = [effectiveCurrency, effectiveRate, settings.numberFormat, settings.dateFormat, settings.timeFormat, settings.timezone].join("|");

  const refresh = useCallback(
    async (manual = false) => {
      try {
        if (manual) { setRefreshing(true); clearApiCache(); }
        setError("");
        const [market, global, trend] = await Promise.all([
          getMarkets({ force: manual, pages: settings.marketPages }),
          getGlobalMarket({ force: manual }).catch(() => null),
          getTrending({ force: manual }).catch(() => null),
        ]);
        if (!Array.isArray(market) || market.length === 0) throw new Error("empty");
        const clean = market
          .filter((c) => c?.id && c.name && c.symbol && c.market_cap_rank != null)
          .sort((a, b) => a.market_cap_rank - b.market_cap_rank);
        setCoins(clean);
        setGlobalMarket(global?.data ?? null);
        setTrending((trend?.coins ?? []).slice(0, 7).map((t) => t.item));
        setUpdatedAt(Date.now());
        hasData.current = true;
      } catch (err) {
        console.error(err);
        if (!hasData.current) {
          const text = String(err?.message ?? "");
          setError(text.includes("rate limit") ? "Market data is rate-limited right now. Wait a moment and retry." : "Market data couldn't be loaded. Check your connection and try again.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [settings.marketPages]
  );

  useEffect(() => {
    refresh();
    if (!settings.refreshMs) return undefined;
    const t = setInterval(() => {
      if (!document.hidden) refresh();
    }, settings.refreshMs);
    return () => clearInterval(t);
  }, [refresh, settings.refreshMs]);

  useEffect(() => {
    let cancelled = false;
    getFxRates(CURRENCIES.map((c) => c.code))
      .then((r) => { if (!cancelled) { setRates(r); setFxFailed(false); } })
      .catch(() => { if (!cancelled) setFxFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const byId = useMemo(() => new Map(coins.map((c) => [c.id, c])), [coins]);

  const value = useMemo(
    () => ({
      coins, byId, globalMarket, trending, loading, refreshing, error, updatedAt, refresh, fmtKey,
      fxProblem: fxFailed && settings.currency !== "usd" && !rate,
      effectiveCurrency,
    }),
    [coins, byId, globalMarket, trending, loading, refreshing, error, updatedAt, refresh, fmtKey, fxFailed, settings.currency, rate, effectiveCurrency]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
