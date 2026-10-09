import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { MobileNav, Sidebar, TickerTape, Topbar } from "./Shell";
import CommandPalette, { ShortcutsModal } from "./CommandPalette";
import { NAV_ITEMS } from "./nav";
import { Skeleton } from "./ui";
import { useData } from "../context/DataContext";
import { useSettings } from "../context/SettingsContext";
import { readStorage, writeStorage } from "../lib/storage";

function isTyping(e) {
  const t = e.target;
  return t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

export default function AppLayout() {
  const { coins, fmtKey, fxProblem } = useData();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => readStorage("metatrack:sidebar", false));
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const pending = useRef(null);
  const main = useRef(null);

  useEffect(() => { writeStorage("metatrack:sidebar", collapsed); }, [collapsed]);

  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); return; }
      if (!settings.shortcuts || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); setShortcuts(true); return; }
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
        const hit = NAV_ITEMS.find((n) => n.key === e.key.toLowerCase());
        if (hit) { e.preventDefault(); navigate(hit.to); }
        return;
      }
      if (e.key.toLowerCase() === "g") pending.current = setTimeout(() => { pending.current = null; }, 1200);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, settings.shortcuts]);

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="shell-main">
        <Topbar onOpenPalette={() => setPalette(true)} onOpenShortcuts={() => setShortcuts(true)} />
        {settings.showTicker && <TickerTape coins={coins} fmtKey={fmtKey} />}
        {fxProblem && (
          <div className="banner banner-warn" role="status">
            Exchange rates couldn't be loaded, so values are shown in USD for now.
          </div>
        )}
        <main id="main" className="page-body" tabIndex={-1} ref={main}>
          <Suspense fallback={<div className="page"><Skeleton h={34} w="40%" /><div style={{ height: 18 }} /><Skeleton h={320} r={18} /></div>}>
            <div className="page" key={location.pathname}><Outlet /></div>
          </Suspense>
        </main>
      </div>
      <MobileNav />
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
    </div>
  );
}
