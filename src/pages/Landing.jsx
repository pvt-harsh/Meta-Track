import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import OrbitHero from "../components/landing/OrbitHero";
import BentoGrid from "../components/landing/BentoGrid";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { ACCOUNT_UNLOCKS, GUEST_CAN } from "../lib/features";
import "../styles/landing.css";

const WORDS_HERO = ["traders", "holders", "analysts", "builders", "everyone"];
const WORDS_ORDER = ["prices", "portfolios", "alerts", "ideas"];

const motionReduced = () => {
  const m = document.documentElement.dataset.motion;
  return m === "reduced" || (m !== "full" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
};

function RotatingWord({ words, interval = 1800, pill = true, className = "" }) {
  const [i, setI] = useState(0);
  const [widths, setWidths] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (motionReduced()) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words.length, interval]);

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const cs = window.getComputedStyle(el);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      setWidths(words.map((w) => Math.ceil(ctx.measureText(w).width)));
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [words]);

  return (
    <span ref={ref} className={`rw ${pill ? "rw-pill" : ""} ${className}`} style={widths[i] ? { width: widths[i] + (pill ? 28 : 0) } : undefined} aria-live="off">
      <span className="sr-only">{words.join(", ")}</span>
      {words.map((w, k) => (
        <span key={w} className={`rw-word ${k === i ? "is-in" : k === (i - 1 + words.length) % words.length ? "is-out" : ""}`} aria-hidden="true">{w}</span>
      ))}
    </span>
  );
}

function ThemeToggle() {
  const { settings, update } = useSettings();
  const dark = (settings.theme === "system" ? document.documentElement.dataset.theme : settings.theme) !== "light";

  const set = useCallback((next, e) => {
    if ((next === "dark") === dark) return;
    const apply = () => { document.documentElement.dataset.theme = next; update({ theme: next }); };
    if (!document.startViewTransition || motionReduced()) { apply(); return; }
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight - 40;
    const d = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const t = document.startViewTransition(apply);
    t.ready.then(() => {
      document.documentElement.animate(
        { maskSize: ["0px 0px", `${d * 2.6}px ${d * 2.6}px`], maskPosition: [`${x}px ${y}px`, `${x - d * 1.3}px ${y - d * 1.3}px`] },
        { duration: 1100, easing: "cubic-bezier(.65,.05,.25,1)", fill: "forwards", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  }, [dark, update]);

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      <button type="button" className={dark ? "on" : ""} aria-pressed={dark} onClick={(e) => set("dark", e)}>Dark</button>
      <button type="button" className={!dark ? "on" : ""} aria-pressed={!dark} onClick={(e) => set("light", e)}>Light</button>
    </div>
  );
}

function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll("[data-reveal]");
    if (motionReduced() || !("IntersectionObserver" in window)) { items.forEach((n) => n.classList.add("in")); return undefined; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    items.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

const DEMO = [
  { q: "bitcoin", rows: [["markets", "Bitcoin", "BTC · Coin"], ["star", "Add Bitcoin to watchlist", "Action"], ["bell", "Create price alert", "Account"]] },
  { q: "heat", rows: [["layers", "Heatmap", "Page"], ["markets", "Markets", "Page"]] },
  { q: "convert", rows: [["grid", "Tools — Converter", "Page"], ["compare", "Compare assets", "Page"]] },
  { q: "sol", rows: [["markets", "Solana", "SOL · Coin"], ["compare", "Compare Solana", "Action"]] },
];
function PaletteDemo() {
  const [step, setStep] = useState({ n: 0, len: 0, dir: 1 });
  useEffect(() => {
    if (motionReduced()) { setStep({ n: 0, len: DEMO[0].q.length, dir: 1 }); return undefined; }
    const { n, len, dir } = step;
    const word = DEMO[n].q;
    let delay = dir === 1 ? 95 : 35;
    let next;
    if (dir === 1 && len < word.length) next = { n, len: len + 1, dir };
    else if (dir === 1) { delay = 1900; next = { n, len, dir: -1 }; }
    else if (len > 0) next = { n, len: len - 1, dir };
    else { delay = 350; next = { n: (n + 1) % DEMO.length, len: 0, dir: 1 }; }
    const id = setTimeout(() => setStep(next), delay);
    return () => clearTimeout(id);
  }, [step]);
  const cur = DEMO[step.n];
  const shown = cur.q.slice(0, step.len);
  return (
    <div className="demo-pal" aria-hidden="true">
      <div className="demo-pal-in"><Icon name="search" size={16} /><span>{shown}<i className="caret" /></span><kbd>Ctrl K</kbd></div>
      <ul>
        {shown.length > 1 && cur.rows.map(([ic, t, s], k) => (
          <li key={`${step.n}-${k}`} style={{ "--d": `${k * 70}ms` }} className={k === 0 ? "hot" : ""}><Icon name={ic} size={15} /><b>{t}</b><small>{s}</small></li>
        ))}
      </ul>
    </div>
  );
}

const FEATURES = [
  { icon: "markets", title: "Live markets", text: "Prices, volume and market cap for the top 1,000 assets — refreshed automatically.", to: "/markets" },
  { icon: "layers", title: "Heatmap", text: "The whole market as one treemap. Spot rotations in a single glance.", to: "/heatmap" },
  { icon: "star", title: "Watchlist", text: "Star what matters. Saved in your browser — no account required.", to: "/watchlist" },
  { icon: "compare", title: "Compare", text: "Put up to four assets on one chart and one table.", to: "/compare" },
  { icon: "grid", title: "Calculators", text: "Converter, profit & loss and position-size tools that never leave your device.", to: "/tools" },
  { icon: "portfolio", title: "Portfolio", text: "Cost basis vs. live value, allocation and profit per holding.", to: "/portfolio" },
  { icon: "bell", title: "Price alerts", text: "Target prices and sharp-move alerts, checked on every refresh.", to: "/alerts" },
  { icon: "download", title: "Backups", text: "Export everything as JSON and restore it anywhere.", to: "/settings?section=privacy" },
];

const MARQUEE = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK", "TON", "LTC", "ATOM", "NEAR", "ARB", "OP", "SUI", "APT", "INJ", "TIA"];
const COINS3D = [["BTC", 33], ["ETH", 232], ["SOL", 275], ["XRP", 205], ["DOGE", 42], ["LINK", 222]];

export default function Landing() {
  const { user, requireAuth } = useAuth();
  const navigate = useNavigate();
  const stage = useRef(null);
  const wmRef = useRef(null);
  useReveal();

  useEffect(() => { document.title = "MetaTrack — Track the whole crypto market. No sign-in needed."; }, []);

  useEffect(() => {
    if (motionReduced()) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(1, window.scrollY / (window.innerHeight * 0.9));
        stage.current?.style.setProperty("--p", p.toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Glass wordmark cursor response: the wordmark tilts/shifts toward the pointer
  // direction (vector from the wordmark's resting center), with a spring for an
  // organic trailing feel, and the specular highlight travels with it. Targets
  // ease back to rest when the pointer idles or leaves. Direct DOM writes only —
  // no React re-renders per mousemove; transform-only (GPU-friendly).
  useEffect(() => {
    if (motionReduced()) return undefined;
    const wm = wmRef.current;
    if (!wm) return undefined;
    const RX = 20, RY = 14, RRX = 5, RRY = 7;
    let tPX = 0, tPY = 0, tRX = 0, tRY = 0, tL = 0, tLO = 0;
    let px = 0, py = 0, rx = 0, ry = 0, lx = 0;
    let vx = 0, vy = 0, vrx = 0, vry = 0;
    let raf = 0, running = false, lastMove = 0, inside = false;
    let cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
    const measure = () => { const r = wm.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; };
    const targets = (dx, dy) => {
      tPX = dx * RX; tPY = dy * RY; tRX = dy * RRX; tRY = dx * RRY; tL = dx;
    };
    const tick = () => {
      const idle = performance.now() - lastMove > 1400;
      if (idle || !inside) { tPX = 0; tPY = 0; tRX = 0; tRY = 0; tL = 0; tLO = 0; }
      else tLO = 1;
      const st = 0.055, dp = 0.84;
      vx = (vx + (tPX - px) * st) * dp; px += vx;
      vy = (vy + (tPY - py) * st) * dp; py += vy;
      vrx = (vrx + (tRX - rx) * st) * dp; rx += vrx;
      vry = (vry + (tRY - ry) * st) * dp; ry += vry;
      lx += (tL - lx) * 0.1;
      const energy = Math.abs(vx) + Math.abs(vy) + Math.abs(vrx) + Math.abs(vry)
        + Math.abs(tPX - px) + Math.abs(tPY - py) + Math.abs(tRX - rx) + Math.abs(tRY - ry);
      if (energy > 0.02) {
        wm.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        wm.style.setProperty("--lx", lx.toFixed(3));
        wm.style.setProperty("--lxo", tLO.toFixed(2));
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
        wm.style.transform = "";
        wm.style.setProperty("--lx", "0");
        wm.style.setProperty("--lxo", "0");
      }
    };
    const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };
    const onMove = (e) => {
      inside = true; lastMove = performance.now();
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      targets(dx, dy);
      kick();
    };
    const onLeave = () => { inside = false; kick(); };
    measure();
    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  const toApp = () => navigate("/dashboard");

  return (
    <div className="landing">
      <nav className="pillnav" aria-label="Main">
        <Link to="/" className="pillnav-logo" aria-label="MetaTrack home"><img src="/favicon.png" width="22" height="22" alt="" /></Link>
        <a href="#features" className="hide-sm">Features</a>
        <Link to="/markets" className="hide-sm">Markets</Link>
        <Link to="/tools" className="hide-md">Tools</Link>
        {user ? <Link to="/account" className="hide-sm">Account</Link> : <button type="button" onClick={() => requireAuth("open")}>Sign in</button>}
        <Link to="/dashboard" className="pill-cta">{user ? "Dashboard" : "Open dashboard"}</Link>
      </nav>

      <header className="lp-hero" ref={stage}>
        <OrbitHero play className="lp-orbit">
          <div className="lp-text" data-orbit-text>
            <h1 ref={wmRef} className="wm wm-modern wm-glass" aria-label="MetaTrack">{"MetaTrack".split("").map((ch, i) => <span key={i} className="wm-l" data-ch={ch} aria-hidden="true" style={{ "--li": i }}>{ch}</span>)}</h1>
            <p className="lp-tag">A crypto tracker for <RotatingWord words={WORDS_HERO} /></p>
            <div className="lp-cta">
              <button type="button" className="btn-hero" onClick={toApp}>Open dashboard <Icon name="arrowRight" size={16} /></button>
            </div>
          </div>
        </OrbitHero>
        <ThemeToggle />
        <a href="#order" className="scroll-cue" aria-label="Scroll to explore"><span>Scroll to explore</span><i><Icon name="arrowDown" size={16} /></i></a>
      </header>

      <main>
        <section id="order" className="sec sec-order">
          <h2 data-reveal className="serif-xl">Bring order to your <br className="hide-sm" />crypto universe</h2>
          <p data-reveal style={{ "--d": "120ms" }} className="sec-sub">One home to follow <RotatingWord words={WORDS_ORDER} pill interval={2000} /></p>
          <div data-reveal style={{ "--d": "200ms" }}><BentoGrid /></div>
        </section>

        <section id="features" className="sec">
          <span className="eyebrow" data-reveal>Everything in one orbit</span>
          <h2 data-reveal className="serif-lg">Built for people who watch the market all day</h2>
          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <Link key={f.title} to={f.to} className="feat" data-reveal style={{ "--d": `${(i % 4) * 70}ms` }}>
                <span className="feat-ic"><Icon name={f.icon} size={20} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="sec sec-split">
          <div>
            <span className="eyebrow" data-reveal>Find anything instantly</span>
            <h2 data-reveal className="serif-lg">Search, jump and act — from the keyboard</h2>
            <p data-reveal className="sec-sub left">Press <kbd>Ctrl</kbd> <kbd>K</kbd> anywhere. Find a coin, open a page, add to your watchlist. Single-key shortcuts like <kbd>G</kbd> then <kbd>M</kbd> get you around in a blink.</p>
          </div>
          <div data-reveal style={{ "--d": "120ms" }}><PaletteDemo /></div>
        </section>

        <section className="sec sec-gate">
          <span className="eyebrow" data-reveal>No sign-in wall</span>
          <h2 data-reveal className="serif-lg">Use it first. Sign in only when it helps.</h2>
          <div className="gate-glow" aria-hidden="true"><i /><i /></div>
          <div className="gate-grid">
            <div className="gate" data-reveal>
              <div className="gate-top"><span className="gate-ic"><Icon name="globe" size={18} /></span><h3>As a guest</h3></div>
              <ul>{GUEST_CAN.map((g, i) => <li key={g} data-reveal style={{ "--d": `${i * 70}ms` }}><Icon name="check" size={15} /><span>{g}</span></li>)}</ul>
              <button type="button" className="btn-hero sm btn-shine" onClick={toApp}><span>Open dashboard</span></button>
            </div>
            <div className="gate gate-pro" data-reveal style={{ "--d": "130ms" }}>
              <div className="gate-top"><span className="gate-ic pro"><Icon name="star" size={18} /></span><h3>With a free account</h3><span className="gate-tag">Free</span></div>
              <ul>{ACCOUNT_UNLOCKS.map((g, i) => <li key={g} data-reveal style={{ "--d": `${130 + i * 70}ms` }}><Icon name="check" size={15} /><span>{g}</span></li>)}</ul>
              <button type="button" className="btn-ghost-l sm btn-shine" onClick={() => requireAuth("open")}><span>{user ? "You're signed in" : "Create account"}</span></button>
            </div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...MARQUEE, ...MARQUEE].map((s, i) => <span key={i}><i />{s}</span>)}
          </div>
        </div>

        <section className="sec sec-cta">
          <div className="ring-wrap" aria-hidden="true">
            <div className="ring">
              {COINS3D.map(([s, h], i) => (
                <span key={s} className="rc" style={{ "--a": `${i * 60}deg`, "--h": h }}><span className="rc-in"><b>{s}</b></span></span>
              ))}
            </div>
          </div>
          <h2 data-reveal className="serif-xl">Start tracking</h2>
          <p data-reveal className="sec-sub">Free, fast, and yours. Your data stays in your browser.</p>
          <div data-reveal className="lp-cta center">
            <button type="button" className="btn-hero" onClick={toApp}>Open dashboard <Icon name="arrowRight" size={16} /></button>
            {!user && <button type="button" className="btn-ghost-l" onClick={() => requireAuth("open")}>Create free account</button>}
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="foot-cols">
          <p>MetaTrack is the home you’ve been searching for when you want the whole market in view.</p>
          <div><b>Explore</b><Link to="/dashboard">Dashboard</Link><Link to="/markets">Markets</Link><Link to="/heatmap">Heatmap</Link><Link to="/tools">Tools</Link></div>
          <div><b>You</b><Link to="/watchlist">Watchlist</Link><Link to="/portfolio">Portfolio</Link><Link to="/alerts">Alerts</Link><Link to="/settings">Settings</Link></div>
        </div>
        <small className="foot-note">Market data via CoinGecko. Not financial advice.</small>
      </footer>
    </div>
  );
}
