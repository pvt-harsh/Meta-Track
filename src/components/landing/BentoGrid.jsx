import { useEffect, useRef } from "react";
import Icon from "../Icon";

const motionReduced = () => {
  const m = document.documentElement.dataset.motion;
  return m === "reduced" || (m !== "full" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
};

export default function BentoGrid() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const cards = [...el.querySelectorAll(".bento-card")];
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } },
      { threshold: 0.2 }
    );
    io.observe(el);
    if (motionReduced() || window.matchMedia("(pointer: coarse)").matches || !cards.length) {
      el.classList.add("in");
      return () => io.disconnect();
    }

    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    let rect = null;
    const onMove = (e) => {
      rect = el.getBoundingClientRect();
      tx = (e.clientX - rect.left) / rect.width - 0.5;
      ty = (e.clientY - rect.top) / rect.height - 0.5;
    };
    const onLeave = () => { tx = 0; ty = 0; };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      if (Math.abs(tx - cx) < 0.0005 && Math.abs(ty - cy) < 0.0005) return;
      const w = rect ? rect.width : el.clientWidth;
      const h = rect ? rect.height : el.clientHeight;
      const mx = (cx + 0.5) * w, my = (cy + 0.5) * h;
      for (const card of cards) {
        const ccx = card.offsetLeft + card.offsetWidth / 2;
        const ccy = card.offsetTop + card.offsetHeight / 2;
        const dx = (mx - ccx) / card.offsetWidth;
        const dy = (my - ccy) / card.offsetHeight;
        card.style.transform = `perspective(1100px) rotateX(${(-dy * 7).toFixed(2)}deg) rotateY(${(dx * 7).toFixed(2)}deg)`;
        card.style.setProperty("--sx", `${(mx - card.offsetLeft).toFixed(1)}px`);
        card.style.setProperty("--sy", `${(my - card.offsetTop).toFixed(1)}px`);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="bento-grid" ref={ref} aria-hidden="true">
      <div className="bento-card bento-btc" style={{ "--i": 0 }}>
        <div className="bento-head"><small>BTC · Bitcoin</small><em className="up">+3.4%</em></div>
        <strong className="bento-price">$97,842.10</strong>
        <svg className="bento-chart" viewBox="0 0 300 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#34d399" stopOpacity="0.35" />
              <stop offset="1" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="bento-area" d="M0,95 C30,90 45,70 70,72 C95,74 110,50 140,52 C170,54 185,30 215,34 C245,38 260,20 300,16 L300,120 L0,120 Z" fill="url(#bgrad)" />
          <path className="bento-line" d="M0,95 C30,90 45,70 70,72 C95,74 110,50 140,52 C170,54 185,30 215,34 C245,38 260,20 300,16" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
          <circle className="bento-dot" cx="300" cy="16" r="4.5" fill="#34d399" />
        </svg>
        <small className="bento-cap">24h price</small>
      </div>
      <div className="bento-card" style={{ "--i": 1 }}>
        <span className="bento-ic"><Icon name="bell" size={18} /></span>
        <b>ETH alert triggered</b>
        <small>Reached your target price</small>
        <span className="bento-pulse" />
      </div>
      <div className="bento-card" style={{ "--i": 2 }}>
        <small>Heatmap</small>
        <div className="mini-heat"><i style={{ "--g": 2 }} /><i style={{ "--g": 1 }} className="d" /><i className="u" /><i className="d" /><i className="u" /><i className="u" /></div>
      </div>
      <div className="bento-card" style={{ "--i": 3 }}>
        <small>Portfolio</small>
        <b className="up">+18.2%</b>
        <div className="fb-bars"><i style={{ height: "40%" }} /><i style={{ height: "62%" }} /><i style={{ height: "48%" }} /><i style={{ height: "80%" }} /><i style={{ height: "70%" }} /><i style={{ height: "94%" }} /></div>
      </div>
      <div className="bento-card" style={{ "--i": 4 }}>
        <span className="bento-ic"><Icon name="star" size={18} /></span>
        <b>Watchlist</b>
        <small>SOL · LINK · TON</small>
      </div>
    </div>
  );
}
