import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import CoinLogo from "../components/CoinLogo";
import { BarCompare, Chart, SERIES_COLORS } from "../components/Charts";
import { Pct } from "../components/CoinTable";
import { EmptyState, PageHeader, Segmented, Skeleton } from "../components/ui";
import { useData } from "../context/DataContext";
import { MAX_COMPARE, useStore } from "../context/StoreContext";
import { getCoinChart } from "../services/cryptoApi";
import { correlation, highLow, maxDrawdown, normalize, num, percentChangeAt, volatility } from "../lib/analytics";
import { formatCompact, formatDate, formatMoneyCompact, formatPercent, formatPrice } from "../lib/format";
import { useDocumentTitle } from "../hooks";

const RANGES = ["24H", "7D", "30D", "1Y", "MAX"];
const DAY = 864e5;

function useSeries(ids, range) {
  const [state, setState] = useState({ data: {}, loading: false, failed: [] });
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) { setState({ data: {}, loading: false, failed: [] }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    Promise.all(ids.map(async (id) => {
      try {
        const [r, y] = await Promise.all([getCoinChart(id, range), range === "1Y" ? null : getCoinChart(id, "1Y")]);
        return { id, range: r?.prices ?? [], year: (y ?? r)?.prices ?? [] };
      } catch { return { id, range: [], year: [], failed: true }; }
    })).then((rows) => {
      if (cancelled) return;
      setState({ data: Object.fromEntries(rows.map((r) => [r.id, r])), loading: false, failed: rows.filter((r) => r.failed).map((r) => r.id) });
    });
    return () => { cancelled = true; };
  }, [key, range]);
  return state;
}

const pctCell = (v) => <Pct value={v} />;
const dash = "—";

export default function Compare() {
  useDocumentTitle("Compare");
  const { coins, byId, loading, fmtKey } = useData();
  const { compare, toggleCompare, clearCompare } = useStore();
  const [range, setRange] = useState("30D");
  const [q, setQ] = useState("");

  const selected = useMemo(() => compare.map((id) => byId.get(id)).filter(Boolean), [compare, byId]);
  const ids = selected.map((c) => c.id);
  const { data, loading: seriesLoading, failed } = useSeries(ids, range);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return coins.filter((c) => !compare.includes(c.id) && (c.name.toLowerCase().includes(t) || c.symbol.toLowerCase().includes(t))).slice(0, 6);
  }, [coins, compare, q]);

  function add(c) { toggleCompare(c.id); setQ(""); }
  const colorOf = (c) => SERIES_COLORS[ids.indexOf(c.id) % SERIES_COLORS.length];

  const derived = useMemo(() => {
    const out = {};
    for (const c of selected) {
      const y = data[c.id]?.year ?? [];
      const last90 = y.filter((p) => p[0] >= (y[y.length - 1]?.[0] ?? 0) - 90 * DAY);
      const hl = highLow(y);
      out[c.id] = {
        d7: c.price_change_percentage_7d_in_currency ?? percentChangeAt(y, 7 * DAY),
        d30: c.price_change_percentage_30d_in_currency ?? percentChangeAt(y, 30 * DAY),
        y1: c.price_change_percentage_1y_in_currency ?? percentChangeAt(y, 365 * DAY),
        vol90: volatility(last90),
        dd: maxDrawdown(y),
        high: hl.high, low: hl.low,
      };
    }
    return out;
  }, [selected, data]);

  const perfSeries = useMemo(() => selected.map((c) => ({ id: c.id, label: c.symbol.toUpperCase(), color: colorOf(c), points: normalize(data[c.id]?.range ?? []) })).filter((s) => s.points.length > 1),
    [selected, data]);

  const corr = useMemo(() => selected.map((a) => selected.map((b) => (a.id === b.id ? 1 : correlation(data[a.id]?.year ?? [], data[b.id]?.year ?? [], 365)))), [selected, data]);

  const groups = [
    { title: "Price & performance", rows: [
      { label: "Market rank", get: (c) => num(c.market_cap_rank), fmt: (c) => (c.market_cap_rank ? `#${c.market_cap_rank}` : dash), best: "low" },
      { label: "Price", get: () => null, fmt: (c) => formatPrice(c.current_price) },
      { label: "1h", get: (c) => num(c.price_change_percentage_1h_in_currency), fmt: (c) => pctCell(c.price_change_percentage_1h_in_currency), best: "high" },
      { label: "24h", get: (c) => num(c.price_change_percentage_24h), fmt: (c) => pctCell(c.price_change_percentage_24h), best: "high" },
      { label: "7d", get: (c) => num(derived[c.id]?.d7), fmt: (c) => pctCell(derived[c.id]?.d7), best: "high" },
      { label: "30d", get: (c) => num(derived[c.id]?.d30), fmt: (c) => pctCell(derived[c.id]?.d30), best: "high" },
      { label: "1 year", get: (c) => num(derived[c.id]?.y1), fmt: (c) => pctCell(derived[c.id]?.y1), best: "high" },
      { label: "24h high / low", get: () => null, fmt: (c) => `${formatPrice(c.high_24h)} / ${formatPrice(c.low_24h)}` },
      { label: "1y high", get: () => null, fmt: (c) => formatPrice(derived[c.id]?.high) },
      { label: "1y low", get: () => null, fmt: (c) => formatPrice(derived[c.id]?.low) },
    ] },
    { title: "Risk", rows: [
      { label: "Volatility (90d, annualised)", get: (c) => num(derived[c.id]?.vol90), fmt: (c) => (derived[c.id]?.vol90 == null ? dash : `${derived[c.id].vol90.toFixed(1)}%`), best: "low" },
      { label: "Max drawdown (1y)", get: (c) => num(derived[c.id]?.dd), fmt: (c) => (derived[c.id]?.dd == null ? dash : formatPercent(derived[c.id].dd, 1)), best: "high" },
      { label: "All-time high", get: () => null, fmt: (c) => formatPrice(c.ath) },
      { label: "Distance from ATH", get: (c) => num(c.ath_change_percentage), fmt: (c) => pctCell(c.ath_change_percentage), best: "high" },
      { label: "ATH date", get: () => null, fmt: (c) => formatDate(c.ath_date) },
    ] },
    { title: "Valuation & liquidity", rows: [
      { label: "Market cap", get: (c) => num(c.market_cap), fmt: (c) => formatMoneyCompact(c.market_cap), best: "high" },
      { label: "Fully diluted valuation", get: (c) => num(c.fully_diluted_valuation), fmt: (c) => formatMoneyCompact(c.fully_diluted_valuation), best: "high" },
      { label: "24h volume", get: (c) => num(c.total_volume), fmt: (c) => formatMoneyCompact(c.total_volume), best: "high" },
      { label: "Volume / market cap", get: (c) => (c.market_cap ? c.total_volume / c.market_cap : null), fmt: (c) => (c.market_cap ? `${((c.total_volume / c.market_cap) * 100).toFixed(2)}%` : dash), best: "high" },
    ] },
    { title: "Supply", rows: [
      { label: "Circulating", get: () => null, fmt: (c) => (c.circulating_supply ? `${formatCompact(c.circulating_supply)} ${c.symbol.toUpperCase()}` : dash) },
      { label: "Total", get: () => null, fmt: (c) => (c.total_supply ? `${formatCompact(c.total_supply)} ${c.symbol.toUpperCase()}` : dash) },
      { label: "Maximum", get: () => null, fmt: (c) => (c.max_supply ? `${formatCompact(c.max_supply)} ${c.symbol.toUpperCase()}` : "No cap") },
      { label: "Circulating / maximum", get: (c) => (c.max_supply ? (c.circulating_supply / c.max_supply) * 100 : null), fmt: (c) => (c.max_supply ? `${((c.circulating_supply / c.max_supply) * 100).toFixed(1)}%` : dash) },
    ] },
  ];

  const bars = (get) => selected.map((c) => ({ id: c.id, label: c.symbol.toUpperCase(), color: colorOf(c), value: get(c) }));

  return (
    <>
      <PageHeader eyebrow="Deep analysis" title="Compare assets"
        description={`Put up to ${MAX_COMPARE} assets side by side: relative performance, risk, valuation and supply.`}
        actions={selected.length > 0 && selected.length < MAX_COMPARE && (
          <div className="combo">
            <label className="search-box"><Icon name="plus" size={16} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && matches[0] && add(matches[0])} placeholder="Add an asset" aria-label="Add an asset to compare" />
            </label>
            {q.trim() && (
              <div className="dropdown combo-list" role="listbox">
                {matches.length === 0 && <div className="combo-empty">No matches.</div>}
                {matches.map((c) => (
                  <button key={c.id} type="button" role="option" onClick={() => add(c)}><CoinLogo coin={c} size={20} /><span>{c.name}</span><small>{c.symbol.toUpperCase()}</small></button>
                ))}
              </div>
            )}
          </div>
        )} />

      {loading ? <Skeleton h={300} r={18} /> : selected.length === 0 ? (
        <EmptyState icon="compare" title="Choose assets to compare"
          description="Add at least two assets to see relative performance, volatility, correlation and valuation side by side."
          action={<Link to="/markets" className="btn btn-primary">Pick from Markets</Link>}
          secondary={
            <button type="button" className="btn" onClick={() => ["bitcoin", "ethereum", "solana"].filter((id) => byId.has(id)).forEach((id) => toggleCompare(id))}>Try Bitcoin, Ethereum & Solana</button>
          } />
      ) : (
        <div data-fmt={fmtKey}>
          <div className="cmp-cards">
            {selected.map((c) => (
              <div className="card cmp-card" key={c.id} style={{ "--accent-line": colorOf(c) }}>
                <button type="button" className="icon-btn cmp-remove" onClick={() => toggleCompare(c.id)} aria-label={`Remove ${c.name}`}><Icon name="close" size={14} /></button>
                <Link to={`/coin/${c.id}`} className="cmp-head"><CoinLogo coin={c} size={32} /><span><b>{c.name}</b><small>{c.symbol.toUpperCase()} · #{c.market_cap_rank}</small></span></Link>
                <strong>{formatPrice(c.current_price)}</strong>
                <Pct value={c.price_change_percentage_24h} />
              </div>
            ))}
            {selected.length === 1 && <div className="card cmp-card cmp-hint"><Icon name="plus" size={18} /><span>Add another asset to start comparing.</span></div>}
          </div>

          <section className="card">
            <div className="card-head">
              <div><span className="eyebrow">Relative performance</span><h2>Growth of 100, rebased to the start of the period</h2></div>
              <Segmented size="sm" label="Range" options={RANGES} value={range} onChange={setRange} />
            </div>
            <div className="legend">
              {selected.map((c) => {
                const pts = normalize(data[c.id]?.range ?? []);
                const ch = pts.length ? pts[pts.length - 1][1] - 100 : null;
                return <span key={c.id}><i style={{ background: colorOf(c) }} />{c.symbol.toUpperCase()} <Pct value={ch} /></span>;
              })}
            </div>
            <div className="cmp-chart">
              {seriesLoading ? <Skeleton h="100%" r={12} /> : (
                <Chart series={perfSeries} area={false} valueFormat={(v) => formatPercent(v - 100, 1)} minHeight={280} ariaLabel="Relative performance chart" />
              )}
            </div>
            {failed.length > 0 && <p className="muted small note">History couldn't be loaded for {failed.map((id) => byId.get(id)?.name ?? id).join(", ")}.</p>}
          </section>

          {selected.length > 1 && (
            <div className="grid-2">
              <section className="card"><div className="card-head"><div><span className="eyebrow">Size</span><h2>Market cap</h2></div></div>
                <BarCompare rows={bars((c) => num(c.market_cap))} format={formatMoneyCompact} /></section>
              <section className="card"><div className="card-head"><div><span className="eyebrow">Liquidity</span><h2>24h volume</h2></div></div>
                <BarCompare rows={bars((c) => num(c.total_volume))} format={formatMoneyCompact} /></section>
              <section className="card"><div className="card-head"><div><span className="eyebrow">Risk</span><h2>Volatility (90d)</h2></div></div>
                <BarCompare rows={bars((c) => num(derived[c.id]?.vol90))} format={(v) => `${v.toFixed(0)}%`} /></section>
              <section className="card"><div className="card-head"><div><span className="eyebrow">Recovery</span><h2>Below all-time high</h2></div></div>
                <BarCompare rows={bars((c) => (c.ath_change_percentage == null ? null : Math.abs(c.ath_change_percentage)))} format={(v) => `−${v.toFixed(1)}%`} /></section>
            </div>
          )}

          <section className="card">
            <div className="card-head"><div><span className="eyebrow">Full breakdown</span><h2>Every metric, side by side</h2></div><span className="muted small hide-sm">Gold marks the strongest value in a row</span></div>
            <div className="table-wrap flat">
              <table className="metrics">
                <thead>
                  <tr><th>Metric</th>{selected.map((c) => <th key={c.id} className="num"><span className="th-coin"><i style={{ background: colorOf(c) }} /><CoinLogo coin={c} size={18} />{c.symbol.toUpperCase()}</span></th>)}</tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.title}>
                    <tr className="group-row"><th colSpan={selected.length + 1}>{g.title}</th></tr>
                    {g.rows.map((row) => {
                      const vals = selected.map((c) => row.get(c));
                      const valid = vals.filter((v) => v != null);
                      const bestVal = row.best && valid.length > 1 ? (row.best === "high" ? Math.max(...valid) : Math.min(...valid)) : null;
                      return (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          {selected.map((c, i) => <td key={c.id} className={`num ${bestVal != null && vals[i] === bestVal ? "best" : ""}`}>{row.fmt(c)}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          {selected.length > 1 && (
            <section className="card">
              <div className="card-head"><div><span className="eyebrow">Diversification</span><h2>Correlation of daily returns (1 year)</h2></div></div>
              <p className="muted small">Close to +1: the assets tend to move together. Close to 0: independent. Negative: they tend to move in opposite directions.</p>
              <div className="table-wrap flat">
                <table className="corr">
                  <thead><tr><th />{selected.map((c) => <th key={c.id} className="num">{c.symbol.toUpperCase()}</th>)}</tr></thead>
                  <tbody>
                    {selected.map((a, i) => (
                      <tr key={a.id}><th scope="row">{a.symbol.toUpperCase()}</th>
                        {selected.map((b, j) => {
                          const v = corr[i]?.[j];
                          return <td key={b.id} className="num" style={v == null ? undefined : { background: `color-mix(in srgb, var(--${v >= 0 ? "gold" : "down"}) ${Math.round(Math.abs(v) * 38)}%, transparent)` }}>{v == null ? dash : v.toFixed(2)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <div className="page-foot"><button type="button" className="btn btn-sm" onClick={clearCompare}>Clear comparison</button></div>
        </div>
      )}
    </>
  );
}
