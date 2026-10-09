import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";
import { REGIONS } from "../lib/format";

const KEY = "metatrack:settings:v2";

export const RANGES = ["1H", "24H", "7D", "30D", "1Y", "MAX"];
export const PAGE_SIZES = [10, 20, 50];
export const COVERAGE = [
  [1, "Top 250"],
  [2, "Top 500"],
  [4, "Top 1,000"],
];

export const DEFAULTS = {
  theme: "dark", 
  currency: "usd",
  numberFormat: "en-US",
  dateFormat: "dmy",
  timeFormat: "12h",
  timezone: "auto",
  pageSize: 20,
  marketPages: 4,
  defaultSort: "rank", 
  defaultRange: "7D",
  refreshMs: 60000,
  showSparklines: true,
  showTicker: true,
  motion: "full", 
  shortcuts: true,
  notifyAlerts: true,
  notifyWatchlist: true,
  watchlistThreshold: 8, 
  notifySystem: true,
};

const Ctx = createContext(null);

function resolveTheme(theme) {
  if (theme !== "system") return theme;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const stored = readStorage(KEY, {});
    if (stored.motion === "system") stored.motion = "full";
    return { ...DEFAULTS, ...stored };
  });

  useEffect(() => {
    writeStorage(KEY, settings);
  }, [settings]);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(settings.theme);
    };
    apply();
    if (settings.theme !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion;
  }, [settings.motion]);

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  const applyRegion = useCallback((regionId) => {
    const r = REGIONS.find((x) => x.id === regionId);
    if (!r) return;
    setSettings((s) => ({
      ...s,
      currency: r.currency,
      numberFormat: r.numberFormat,
      dateFormat: r.dateFormat,
      timeFormat: r.timeFormat,
      timezone: r.timezone,
    }));
  }, []);

  const reset = useCallback(() => setSettings({ ...DEFAULTS }), []);

  const value = useMemo(
    () => ({ settings, update, applyRegion, reset }),
    [settings, update, applyRegion, reset]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
