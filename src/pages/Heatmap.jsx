import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CoinLogo from "../components/CoinLogo";
import { ErrorState, PageHeader, Segmented, Skeleton } from "../components/ui";
import { useData } from "../context/DataContext";
import { useDocumentTitle } from "../hooks";
import { formatPercent, formatPrice } from "../lib/format";

function squarify(items, x, y, w, h) {
  const out = [];
  let rest = items;
  const worst = (row, s) => {
    const sum = row.reduce((a, b) => a + b.v, 0);
    const mx = Math.max(...row.map((r) => r.v));
    const mn = Math.min(...row.map((r) => r.v));
    return Math.max((s * s * mx) / (sum * sum), (sum * sum) / (s * s * mn));
  };
  while (rest.length) {
    const short = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], short) <= worst(row, short)) row.push(rest[i++]);
    const sum = row.reduce((a, b) => a + b.v, 0);
    if (w >= h) {
      const rw = sum / h;
      let cy = y;
      for (const r of row) { const rh = r.v / rw; out.push({ ...r, x, y: cy, w: rw, h: rh }); cy += rh; }
      x += rw; w -= rw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const r of row) { const rw2 = r.v / rh; out.push({ ...r, x: cx, y, w: rw2, h: rh }); cx += rw2; }
      y += rh; h -= rh;
    }
    rest = rest.slice(i);
  }
  return out;
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.("(max-width: 720px)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function tileColor(pct) {
  const v = Number(pct);
  if (!Number.isFinite(v)) return "var(--surface-3)";
  const strength = Math.min(Math.abs(v) / 10, 1);
  const base = v >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${Math.round(18 + strength * 62)}%, var(--surface-2))`;
}

const COUNTS = [{ value: 25, label: "Top 25" }, { value: 50, label: "Top 50" }, { value: 100, label: "Top 100" }];
const SIZES = [{ value: "market_cap", label: "Market cap" }, { value: "total_volume", label: "24h volume" }];

export default function Heatmap() {
  useDocumentTitle("Heatmap");
  const { coins, loading, error, refresh, refreshing, fmtKey } = useData();
  const navigate = useNavigate();
  const narrow = useNarrow();
  const [count, setCount] = useState(50);
  const [sizeBy, setSizeBy] = useState("market_cap");
  const [hover, setHover] = useState(null);

  const W = 100;
  const H = narrow ? 130 : 56;

  const tiles = useMemo(() => {
    const list = coins.slice(0, count).filter((c) => Number(c[sizeBy]) > 0);
    if (!list.length) return [];
    const total = list.reduce((a, c) => a + Number(c[sizeBy]), 0);
    const items = list.map((c) => ({ coin: c, v: (Number(c[sizeBy]) / total) * W * H })).sort((a, b) => b.v - a.v);
    return squarify(items, 0, 0, W, H);
  }, [coins, count, sizeBy, H]);

  const stats = useMemo(() => {
    const list = coins.slice(0, count);
    const up = list.filter((c) => c.price_change_percentage_24h > 0).length;
    return { up, down: list.length - up };
  }, [coins, count]);

  if (error && !coins.length) return <ErrorState message={error} onRetry={() => refresh(true)} retrying={refreshing} />;

  return (
    <div data-fmt={fmtKey}>
      <PageHeader eyebrow="Heatmap" title="Market at a glance"
        description="Tile size shows market cap or volume; colour shows the 24-hour move. Click any tile to open the coin."
        actions={<div className="heat-controls"><Segmented size="sm" label="Number of assets" value={count} onChange={setCount} options={COUNTS} /><Segmented size="sm" label="Size by" value={sizeBy} onChange={setSizeBy} options={SIZES} /></div>} />

      <div className="heat-legend" aria-hidden="true">
        <span>−10%</span><i className="heat-ramp" /><span>+10%</span>
        {!loading && <em>{stats.up} up · {stats.down} down</em>}
      </div>

      {loading && !coins.length ? <Skeleton h={420} r={18} /> : (
        <div className="heatmap" style={{ aspectRatio: `${W} / ${H}` }} role="list" aria-label="Market heatmap">
          {tiles.map(({ coin, x, y, w, h }) => {
            const area = w * h;
            const size = area > 260 ? "xl" : area > 90 ? "lg" : area > 32 ? "md" : "sm";
            return (
              <button key={coin.id} type="button" role="listitem" className={`heat-tile heat-${size}`}
                style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%`, background: tileColor(coin.price_change_percentage_24h) }}
                onClick={() => navigate(`/coin/${coin.id}`)} onMouseEnter={() => setHover(coin.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(coin.id)} onBlur={() => setHover(null)}
                aria-label={`${coin.name}, ${formatPrice(coin.current_price)}, ${formatPercent(coin.price_change_percentage_24h)} in 24 hours`}>
                <span className="heat-in">
                  {size !== "sm" && <CoinLogo coin={coin} size={size === "xl" ? 30 : 20} />}
                  <b>{coin.symbol.toUpperCase()}</b>
                  {size !== "sm" && <span>{formatPercent(coin.price_change_percentage_24h, 2)}</span>}
                  {(size === "xl" || size === "lg") && <small>{formatPrice(coin.current_price)}</small>}
                </span>
                {hover === coin.id && size === "sm" && <span className="heat-tip">{coin.symbol.toUpperCase()} {formatPercent(coin.price_change_percentage_24h, 2)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
