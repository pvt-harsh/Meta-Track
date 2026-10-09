import { memo, useEffect, useMemo, useRef } from "react";


const ASSETS = [
  { s: "BTC", h: 33 }, { s: "ETH", h: 232 }, { s: "SOL", h: 275 }, { s: "BNB", h: 46 },
  { s: "XRP", h: 205 }, { s: "ADA", h: 218 }, { s: "DOGE", h: 42 }, { s: "AVAX", h: 355 },
  { s: "DOT", h: 322 }, { s: "LINK", h: 222 }, { s: "TON", h: 200 }, { s: "LTC", h: 210 },
  { s: "ATOM", h: 255 }, { s: "NEAR", h: 160 }, { s: "ARB", h: 208 }, { s: "OP", h: 352 },
  { s: "SUI", h: 195 }, { s: "APT", h: 150 }, { s: "INJ", h: 188 }, { s: "TIA", h: 285 },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - t) ** 3;

function sparkPath(rnd, up) {
  const n = 14;
  let y = 0.5;
  const pts = [];
  for (let i = 0; i < n; i++) {
    y += (rnd() - 0.5) * 0.22 + (up ? -0.035 : 0.035);
    y = clamp(y, 0.08, 0.92);
    pts.push(`${((i / (n - 1)) * 100).toFixed(1)},${(y * 40).toFixed(1)}`);
  }
  return pts.join(" ");
}

function buildSpecs({ count, images, mobile }) {
  const rnd = mulberry32(20261009);
  const particles = [];
  const cards = [];
  for (let i = 0; i < count; i++) {
    const z = Math.pow(rnd(), 0.8);                       
    const asset = ASSETS[Math.floor(rnd() * ASSETS.length)];
    const thumb = rnd() < 0.2;
    const base = thumb ? 30 + rnd() * 18 : 74 + rnd() * 62;
    const w = Math.round(base * (0.55 + z * 0.9));
    const ratio = thumb ? 1 : [0.78, 1, 1.28][Math.floor(rnd() * 3)];
    const h = Math.round(w * ratio);
    const side = rnd() < 0.5 ? 0 : Math.PI;
    const th0 = rnd() < 0.78 ? side + (rnd() + rnd() + rnd() - 1.5) * 1.15 : rnd() * Math.PI * 2;
    const up = rnd() > 0.38;
    const variant = thumb ? "chip" : ["art", "price", "chart"][Math.floor(rnd() * 3)];
    const image = images?.length ? images[i % images.length] : null;
    const card = {
      id: i, w, h, z, asset, up, variant, image, thumb,
      change: ((rnd() * 9 + 0.4) * (up ? 1 : -1)).toFixed(1),
      spark: sparkPath(rnd, up),
    };
    cards.push(card);
    const om = (0.10 + rnd() * 0.07) * (0.55 + z * 0.95);  
    const trail = !mobile && z > 0.62 && rnd() < 0.7 ? 3 : 0;
    const common = {
      th0, om, rs: 0.6 + rnd() * 0.5, ra: 0.05 + rnd() * 0.07, rp: rnd() * 6.28, rr: 0.05 + rnd() * 0.08,
      r0: (rnd() - 0.5) * 70, sp: (rnd() - 0.5) * 9, tx: (rnd() - 0.5) * 30, ty: (rnd() - 0.5) * 36,
      par: 10 + z * 30, w, h, op: 0.32 + z * 0.68,
    };
    particles.push({ ...common, card: i, lag: 0, k: 0 });
    for (let k = 1; k <= trail; k++) particles.push({ ...common, card: i, lag: k * 0.34, k, op: common.op * (0.34 / k) });
  }
  return { cards, particles };
}

const Face = memo(function Face({ c }) {
  const style = { "--h": c.asset.h };
  if (c.image) return <span className="oc-face oc-photo" style={{ backgroundImage: `url(${c.image})` }} />;
  if (c.variant === "chip") {
    return <span className="oc-face oc-chip" style={style}><b>{c.asset.s.slice(0, 3)}</b></span>;
  }
  return (
    <span className={`oc-face oc-${c.variant}`} style={style}>
      {c.variant === "art" && <i className="oc-glyph">{c.asset.s[0]}</i>}
      <span className="oc-meta"><b>{c.asset.s}</b><em className={c.up ? "up" : "down"}>{c.up ? "+" : ""}{c.change}%</em></span>
      {c.variant !== "art" && (
        <svg className="oc-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={c.spark} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </span>
  );
});

export default function OrbitHero({ play = true, cardCount, speed = 1, images, accentColor, children, className = "" }) {
  const root = useRef(null);
  const els = useRef([]);
  const live = useRef({ play, speed });
  live.current = { play, speed };

  const mobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px)").matches;
  const count = cardCount ?? (mobile ? 24 : 44);
  const { cards, particles } = useMemo(() => buildSpecs({ count, images, mobile }), [count, images, mobile]);

  useEffect(() => {
    const host = root.current;
    if (!host) return undefined;
    const size = { W: 1, H: 1, hw: 1, hh: 1, cy: 0 };
    const mouse = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let t = 14;                 
    let introAt = null;
    let ip = 0;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let acc = 0, frames = 0, settled = false;   

    const reduced = () => {
      const m = document.documentElement.dataset.motion;
      return m === "reduced" || (m !== "full" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    };

    function measure() {
      const r = host.getBoundingClientRect();
      size.W = r.width; size.H = r.height;
      const tr = host.querySelector("[data-orbit-text]")?.getBoundingClientRect();
      if (tr) {
        size.hw = tr.width / 2 + 28;
        size.hh = tr.height / 2 + 36;
        size.cy = tr.top + tr.height / 2 - (r.top + r.height / 2);
      }
    }

    function render() {
      const { W, H, hw, hh, cy } = size;
      const RX = W * 0.56, RY = H * 0.54;
      const rf = 0.22 + 0.78 * ip;
      const px = cur.x, py = cur.y;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const el = els.current[i];
        if (!el) continue;
        const tt = t - p.lag;
        const th = p.th0 + p.om * tt - (1 - ip) * 1.5;
        const rr = p.rs * (1 + p.ra * Math.sin(p.rp + tt * p.rr)) * rf;
        const x = Math.cos(th) * RX * rr + -px * p.par * 2;
        const y = Math.sin(th) * RY * rr + -py * p.par * 2;
        const d = Math.max(Math.abs(x) / hw, Math.abs(y - cy) / hh);
        const fade = smooth(0.72, 1.12, d);
        const o = p.op * fade * ip;
        if (o < 0.004) { 
          if (el.style.opacity !== "0") el.style.opacity = "0";
          continue;
        }
        el.style.transform = `translate3d(${(x - p.w / 2).toFixed(1)}px,${(y - p.h / 2).toFixed(1)}px,0) rotateX(${(p.tx + Math.sin(tt * 0.35 + p.rp) * 9).toFixed(1)}deg) rotateY(${(p.ty + Math.cos(tt * 0.3 + p.rp) * 9).toFixed(1)}deg) rotateZ(${(p.r0 + p.sp * tt).toFixed(1)}deg)`;
        el.style.opacity = o.toFixed(3);
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, raw);
      last = now;
      if (!visible || document.hidden) return;
      if (!settled && ip >= 1 && raw < 0.5) {
        acc += raw; frames += 1;
        if (frames === 60) { settled = true; if (acc / frames > 0.034) host.dataset.quality = "low"; }
      }
      const { play: go, speed: sp } = live.current;
      if (go && introAt == null) introAt = now;
      ip = introAt == null ? 0 : easeOut(clamp((now - introAt) / 2000, 0, 1));
      t += dt * sp;
      if (introAt == null) return; 
      const k = 1 - Math.pow(1 - 0.08, dt * 60);       
      cur.x += (mouse.x - cur.x) * k;
      cur.y += (mouse.y - cur.y) * k;
      render();
    }

    function onMove(e) {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    }
    function onTilt(e) {
      if (e.gamma == null) return;
      mouse.x = clamp(e.gamma / 45, -0.5, 0.5);
      mouse.y = clamp(((e.beta ?? 45) - 45) / 60, -0.5, 0.5);
    }

    measure();
    const ro = new ResizeObserver(() => { measure(); if (reduced()) render(); });
    ro.observe(host);
    const textEl = host.querySelector("[data-orbit-text]");
    if (textEl) ro.observe(textEl);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(host);

    if (reduced()) {
      ip = 1; t = 14; render();
      return () => { ro.disconnect(); io.disconnect(); };
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [particles]);

  return (
    <div className={`orbit-hero ${className}`} ref={root} style={accentColor ? { "--orbit-glow": accentColor } : undefined}>
      <div className="orbit-glow" aria-hidden="true" />
      <div className="orbit-stars" aria-hidden="true" />
      <div className="orbit-layer" aria-hidden="true">
        {particles.map((p, i) => {
          const c = cards[p.card];
          const blur = p.k === 0 ? Math.max(0, (0.55 - c.z) * 5.5) : 1.2 + p.k * 0.9;
          return (
            <span key={i} ref={(el) => { els.current[i] = el; }}
              className={`oc ${p.k ? "oc-ghost" : ""}`}
              style={{ width: p.w, height: p.h, "--w": `${p.w}px`, "--h": c.asset.h, zIndex: Math.round(c.z * 100), filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined, opacity: 0 }}>
              {p.k === 0 && <Face c={c} />}
            </span>
          );
        })}
      </div>
      <div className="orbit-content">{children}</div>
    </div>
  );
}
