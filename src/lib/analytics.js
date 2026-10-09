export const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function percentChangeAt(series, msAgo) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const last = series[series.length - 1];
  const target = last[0] - msAgo;
  if (series[0][0] > target + msAgo * 0.15) return null; 
  let best = series[0];
  let bestDiff = Infinity;
  for (const p of series) {
    const d = Math.abs(p[0] - target);
    if (d < bestDiff) { best = p; bestDiff = d; }
  }
  return best[1] ? ((last[1] - best[1]) / best[1]) * 100 : null;
}

export function downsample(series, n = 240) {
  if (!Array.isArray(series) || series.length <= n) return series ?? [];
  const out = [];
  const step = (series.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(series[Math.round(i * step)]);
  return out;
}

export function normalize(series) {
  if (!series?.length || !series[0][1]) return [];
  const base = series[0][1];
  return series.map(([t, v]) => [t, (v / base) * 100]);
}

export function volatility(series) {
  if (!series || series.length < 8) return null;
  const rets = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1][1] > 0 && series[i][1] > 0) rets.push(Math.log(series[i][1] / series[i - 1][1]));
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const spanMs = series[series.length - 1][0] - series[0][0];
  const perYear = (rets.length / spanMs) * 365 * 24 * 3600 * 1000;
  return Math.sqrt(variance * perYear) * 100;
}

export function maxDrawdown(series) {
  if (!series || series.length < 2) return null;
  let peak = series[0][1];
  let worst = 0;
  for (const [, v] of series) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.min(worst, (v - peak) / peak);
  }
  return worst * 100;
}

export function correlation(a, b, n = 120) {
  const A = downsample(a, n);
  const B = downsample(b, n);
  const len = Math.min(A.length, B.length);
  if (len < 10) return null;
  const ra = [];
  const rb = [];
  for (let i = 1; i < len; i++) {
    if (A[i - 1][1] > 0 && B[i - 1][1] > 0) {
      ra.push(A[i][1] / A[i - 1][1] - 1);
      rb.push(B[i][1] / B[i - 1][1] - 1);
    }
  }
  const m = ra.length;
  if (m < 8) return null;
  const ma = ra.reduce((x, y) => x + y, 0) / m;
  const mb = rb.reduce((x, y) => x + y, 0) / m;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < m; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : null;
}

export function highLow(series) {
  if (!series?.length) return { high: null, low: null };
  let high = -Infinity, low = Infinity;
  for (const [, v] of series) { if (v > high) high = v; if (v < low) low = v; }
  return { high, low };
}
