import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatDate, formatTime, getFormatState } from "../lib/format";
import { downsample } from "../lib/analytics";

const PAD = { top: 14, right: 64, bottom: 26, left: 6 };

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function axisDate(ms, spanMs) {
  const tz = getFormatState().timezone;
  const tzOpt = tz === "auto" ? {} : { timeZone: tz };
  if (spanMs <= 2 * 864e5) return formatTime(ms);
  if (spanMs > 500 * 864e5) return new Intl.DateTimeFormat("en-GB", { ...tzOpt, month: "short", year: "numeric" }).format(ms);
  return new Intl.DateTimeFormat("en-GB", { ...tzOpt, day: "numeric", month: "short" }).format(ms);
}

function nearest(points, t) {
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] < t) lo = mid; else hi = mid;
  }
  return Math.abs(points[lo][0] - t) <= Math.abs(points[hi][0] - t) ? points[lo] : points[hi];
}

export function Chart({ series, valueFormat, area = true, minHeight = 160, ariaLabel = "Price chart" }) {
  const wrap = useRef(null);
  const { w, h } = useSize(wrap);
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);

  const data = useMemo(
    () => series.map((s) => ({ ...s, points: downsample(s.points ?? [], 260).filter((p) => Number.isFinite(p[1])) })).filter((s) => s.points.length > 1),
    [series]
  );

  const geo = useMemo(() => {
    if (!data.length || w < 40 || h < 40) return null;
    let tMin = Infinity, tMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const s of data) for (const [t, v] of s.points) {
      if (t < tMin) tMin = t; if (t > tMax) tMax = t;
      if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }
    const pad = (vMax - vMin || Math.abs(vMax) * 0.02 || 1) * 0.08;
    vMin -= pad; vMax += pad;
    const iw = w - PAD.left - PAD.right;
    const ih = h - PAD.top - PAD.bottom;
    const x = (t) => PAD.left + ((t - tMin) / (tMax - tMin || 1)) * iw;
    const y = (v) => PAD.top + (1 - (v - vMin) / (vMax - vMin || 1)) * ih;
    const yTicks = Array.from({ length: 4 }, (_, i) => vMin + ((vMax - vMin) * (i + 0.5)) / 4);
    const xCount = w < 420 ? 3 : 5;
    const xTicks = Array.from({ length: xCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xCount - 1));
    return { tMin, tMax, vMin, vMax, x, y, yTicks, xTicks, iw, ih, span: tMax - tMin };
  }, [data, w, h]);

  function onMove(e) {
    if (!geo) return;
    const rect = wrap.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const t = geo.tMin + ((px - PAD.left) / geo.iw) * geo.span;
    if (t < geo.tMin - geo.span * 0.02 || t > geo.tMax + geo.span * 0.02) { setHover(null); return; }
    const rows = data.map((s) => ({ s, p: nearest(s.points, Math.min(Math.max(t, geo.tMin), geo.tMax)) }));
    setHover({ t: rows[0].p[0], rows, px: geo.x(rows[0].p[0]) });
  }

  const empty = !data.length;
  return (
    <div className="chart" ref={wrap} style={{ minHeight }}>
      {empty && <div className="chart-empty">Chart data isn't available for this range.</div>}
      {!empty && geo && (
        <>
          <svg width={w} height={h} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <defs>
              {data.map((s) => (
                <linearGradient key={s.id} id={`${gid}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {geo.yTicks.map((v, i) => (
              <g key={i}>
                <line className="chart-grid" x1={PAD.left} x2={w - PAD.right} y1={geo.y(v)} y2={geo.y(v)} />
                <text className="chart-axis" x={w - PAD.right + 8} y={geo.y(v) + 3.5}>{valueFormat(v)}</text>
              </g>
            ))}
            {geo.xTicks.map((t, i, a) => (
              <text key={i} className="chart-axis" x={geo.x(t)} y={h - 8} textAnchor={i === 0 ? "start" : i === a.length - 1 ? "end" : "middle"}>
                {axisDate(t, geo.span)}
              </text>
            ))}
            <g className="chart-reveal">
              {data.map((s) => {
                const line = s.points.map(([t, v], i) => `${i ? "L" : "M"}${geo.x(t).toFixed(1)},${geo.y(v).toFixed(1)}`).join("");
                const last = s.points[s.points.length - 1];
                return (
                  <g key={s.id}>
                    {area && data.length === 1 && (
                      <path d={`${line}L${geo.x(last[0]).toFixed(1)},${h - PAD.bottom}L${geo.x(s.points[0][0]).toFixed(1)},${h - PAD.bottom}Z`} fill={`url(#${gid}-${s.id})`} />
                    )}
                    <path d={line} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                );
              })}
            </g>
            {hover && (
              <g pointerEvents="none">
                <line className="chart-cross" x1={hover.px} x2={hover.px} y1={PAD.top} y2={h - PAD.bottom} />
                {hover.rows.map(({ s, p }) => (
                  <circle key={s.id} cx={geo.x(p[0])} cy={geo.y(p[1])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
                ))}
              </g>
            )}
          </svg>
          {hover && (
            <div className="chart-tip" style={{ left: Math.min(Math.max(hover.px, 70), w - PAD.right - 70), top: 8 }}>
              <small>{formatDate(hover.t)} · {formatTime(hover.t)}</small>
              {hover.rows.map(({ s, p }) => (
                <div key={s.id}>
                  {data.length > 1 && <i style={{ background: s.color }} />}
                  {data.length > 1 && <span>{s.label}</span>}
                  <b>{valueFormat(p[1])}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Sparkline({ points, width = 112, height = 34 }) {
  const values = useMemo(() => (Array.isArray(points) ? downsample(points.map((v, i) => [i, Number(v)]), 56).map((p) => p[1]).filter(Number.isFinite) : []), [points]);
  if (values.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const step = width / (values.length - 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`).join("");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className={`sparkline ${up ? "up" : "down"}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Donut({ slices, size = 168, center }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return null;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const starts = slices.reduce((acc, s, i) => [...acc, i ? acc[i - 1] + (slices[i - 1].value / total) * c : 0], []);
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Allocation chart">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
          {slices.map((s, i) => {
            const len = Math.max((s.value / total) * c - 2, 0);
            return <circle key={s.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-starts[i]} />;
          })}
        </g>
      </svg>
      <div className="donut-center">{center}</div>
    </div>
  );
}

export function BarCompare({ rows, format }) {
  const max = Math.max(...rows.map((r) => r.value ?? 0), 0) || 1;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.id}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(((r.value ?? 0) / max) * 100, r.value ? 1.5 : 0)}%`, background: r.color }} /></span>
          <b className="bar-value">{r.value == null ? "—" : format(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

export const SERIES_COLORS = ["#8b7cff", "#4fc3f7", "#5fd6a0", "#ff8fb1"];
