import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import CoinLogo from "../components/CoinLogo";
import CoinTable, { Pct } from "../components/CoinTable";
import { Chart } from "../components/Charts";
import { EmptyState, ErrorState, Segmented, Skeleton, TableSkeleton } from "../components/ui";
import { useData } from "../context/DataContext";
import { RANGES, useSettings } from "../context/SettingsContext";
import { useStore } from "../context/StoreContext";
import { periodChange, useChart, useCoinActions, useDocumentTitle } from "../hooks";
import { formatMoneyCompact, formatPercent, formatPrice, formatInt, tone } from "../lib/format";

function Stat({ label, value, sub, subTone, loading }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      {loading ? <Skeleton h={26} w="70%" /> : <strong className="stat-value">{value}</strong>}
      {sub != null && !loading && <span className={`stat-sub ${subTone ? `pct-${subTone}` : ""}`}>{sub}</span>}
    </div>
  );
}

export default function Home() {
  useDocumentTitle("");
  const { coins, byId, globalMarket: g, trending, loading, error, refresh, refreshing, fmtKey } = useData();
  const { settings } = useSettings();
  const { watchlist, activeAlerts } = useStore();
  const actions = useCoinActions();
  const navigate = useNavigate();

  const [spotId, setSpotId] = useState("bitcoin");
  const [range, setRange] = useState(settings.defaultRange);
  const [movers, setMovers] = useState("gainers");
  const spot = byId.get(spotId) ?? coins[0];
  const chart = useChart(spot?.id, range);
  const chartChange = periodChange(chart.points);

  const top100 = useMemo(() => coins.slice(0, 100), [coins]);
  const gainers = useMemo(() => [...top100].sort((a, b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999)).slice(0, 5), [top100]);
  const losers = useMemo(() => [...top100].sort((a, b) => (a.price_change_percentage_24h ?? 999) - (b.price_change_percentage_24h ?? 999)).slice(0, 5), [top100]);

  const insights = useMemo(() => {
    if (!top100.length) return null;
    const up = top100.filter((c) => c.price_change_percentage_24h > 0).length;
    const byVol = [...top100].sort((a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0))[0];
    const nearAth = [...coins.slice(0, 50)].sort((a, b) => (b.ath_change_percentage ?? -999) - (a.ath_change_percentage ?? -999))[0];
    const turnover = [...top100].filter((c) => c.market_cap > 0).sort((a, b) => b.total_volume / b.market_cap - a.total_volume / a.market_cap)[0];
    return { up, down: top100.length - up, byVol, nearAth, turnover };
  }, [top100, coins]);

  const watched = useMemo(() => watchlist.map((id) => byId.get(id)).filter(Boolean).slice(0, 5), [watchlist, byId]);
  const mcapChange = g?.market_cap_change_percentage_24h_usd;
  const btcDom = g?.market_cap_percentage?.btc;
  const headline = g
    ? `The crypto market is worth ${formatMoneyCompact(g.total_market_cap?.usd)}, ${mcapChange >= 0 ? "up" : "down"} ${formatPercent(Math.abs(mcapChange), 2, false)} over the last 24 hours. Bitcoin holds ${btcDom?.toFixed(1)}% of it.`
    : "Live prices, market structure and your own watchlist, portfolio and alerts in one place.";

  if (error && !coins.length) {
    return <ErrorState message={error} onRetry={() => refresh(true)} retrying={refreshing} />;
  }

  return (
    <div className="home" data-fmt={fmtKey}>
      <section className="hero reveal">
        <div className="hero-copy">
          <span className="eyebrow">Market overview</span>
          <h1>Track the market.</h1>
          <p>{loading ? <Skeleton h={18} w="80%" /> : headline}</p>
          <div className="hero-actions">
            <Link to="/markets" className="btn btn-primary">Explore markets <Icon name="arrowRight" size={15} /></Link>
            <Link to="/alerts" className="btn">Set a price alert</Link>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-figure">
            <span className="stat-label">Total market cap</span>
            {loading ? <Skeleton h={44} w="60%" /> : <strong>{formatMoneyCompact(g?.total_market_cap?.usd)}</strong>}
            {!loading && mcapChange != null && <span className={`pct pct-${tone(mcapChange)}`}><Icon name={mcapChange >= 0 ? "trendUp" : "trendDown"} size={14} /> {formatPercent(mcapChange)} · 24h</span>}
          </div>
        </div>
      </section>

      <section className="stats reveal" aria-label="Global market statistics">
        <Stat loading={loading} label="24h volume" value={formatMoneyCompact(g?.total_volume?.usd)} />
        <Stat loading={loading} label="BTC dominance" value={btcDom ? `${btcDom.toFixed(2)}%` : "—"} />
        <Stat loading={loading} label="ETH dominance" value={g?.market_cap_percentage?.eth ? `${g.market_cap_percentage.eth.toFixed(2)}%` : "—"} />
        <Stat loading={loading} label="Active assets" value={g?.active_cryptocurrencies ? formatInt(g.active_cryptocurrencies) : "—"} />
        <Stat loading={loading} label="Markets" value={g?.markets ? formatInt(g.markets) : "—"} />
      </section>

      <div className="grid-spot reveal">
        <section className="card spotlight">
          <div className="card-head">
            <div>
              <span className="eyebrow">Spotlight</span>
              <h2>{spot ? spot.name : "Market chart"}</h2>
            </div>
            <Segmented size="sm" label="Chart range" options={RANGES} value={range} onChange={setRange} />
          </div>
          {spot && (
            <div className="spot-price">
              <strong>{formatPrice(spot.current_price)}</strong>
              <Pct value={chartChange ?? spot.price_change_percentage_24h} />
              <span className="muted">{range} change</span>
            </div>
          )}
          <div className="spot-chart">
            {chart.loading ? <Skeleton h="100%" r={12} /> : chart.error ? (
              <ErrorState message="This chart couldn't be loaded." onRetry={chart.retry} />
            ) : (
              <Chart series={[{ id: "p", label: spot?.name, color: (chartChange ?? 0) >= 0 ? "var(--up)" : "var(--down)", points: chart.points }]} valueFormat={formatPrice} minHeight={240} ariaLabel={`${spot?.name} price chart`} />
            )}
          </div>
          <div className="spot-picker" role="group" aria-label="Choose asset">
            {coins.slice(0, 6).map((c) => (
              <button key={c.id} type="button" className={`chip ${spotId === c.id ? "active" : ""}`} aria-pressed={spotId === c.id} onClick={() => setSpotId(c.id)}>
                <CoinLogo coin={c} size={16} />{c.symbol.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="card movers">
          <div className="card-head">
            <div><span className="eyebrow">Top 100 · 24h</span><h2>What's moving</h2></div>
          </div>
          <Segmented size="sm" label="Movers" value={movers} onChange={setMovers} options={[{ value: "gainers", label: "Gainers" }, { value: "losers", label: "Losers" }]} />
          <ol className="mover-list">
            {loading && Array.from({ length: 5 }).map((_, i) => <li key={i}><Skeleton h={36} /></li>)}
            {!loading && (movers === "gainers" ? gainers : losers).map((c, i) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate(`/coin/${c.id}`)}>
                  <span className="mover-rank">{i + 1}</span>
                  <CoinLogo coin={c} size={26} />
                  <span className="mover-name"><b>{c.symbol.toUpperCase()}</b><small>{c.name}</small></span>
                  <span className="mover-price">{formatPrice(c.current_price)}</span>
                  <Pct value={c.price_change_percentage_24h} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="reveal">
        <div className="section-head">
          <div><span className="eyebrow">Markets</span><h2>Largest assets by market cap</h2></div>
          <Link to="/markets" className="link-btn">View all markets <Icon name="arrowRight" size={14} /></Link>
        </div>
        {loading ? <TableSkeleton rows={8} /> : (
          <CoinTable coins={coins.slice(0, 8)} showSparklines={settings.showSparklines} {...actions} />
        )}
      </section>

      <div className="grid-3 reveal">
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Your market watch</span><h2>Watchlist</h2></div>
            {watched.length > 0 && <Link to="/watchlist" className="link-btn">All</Link>}</div>
          {watched.length === 0 ? (
            <EmptyState icon="star" title="Nothing on watch yet" description="Star assets to keep their price and moves here." action={<Link to="/markets" className="btn btn-sm">Explore markets</Link>} />
          ) : (
            <ul className="mini-list">
              {watched.map((c) => (
                <li key={c.id}><button type="button" onClick={() => navigate(`/coin/${c.id}`)}>
                  <CoinLogo coin={c} size={24} /><b>{c.symbol.toUpperCase()}</b><span>{formatPrice(c.current_price)}</span><Pct value={c.price_change_percentage_24h} />
                </button></li>
              ))}
            </ul>
          )}
          {activeAlerts > 0 && <Link to="/alerts" className="card-note"><Icon name="bell" size={14} /> {activeAlerts} active price alert{activeAlerts > 1 ? "s" : ""}</Link>}
        </section>

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Search interest</span><h2>Trending</h2></div></div>
          <ul className="mini-list">
            {loading && Array.from({ length: 5 }).map((_, i) => <li key={i}><Skeleton h={30} /></li>)}
            {!loading && trending.length === 0 && <li className="muted small">Trending data isn't available right now.</li>}
            {trending.slice(0, 6).map((t, i) => (
              <li key={t.id}><button type="button" onClick={() => byId.has(t.id) ? navigate(`/coin/${t.id}`) : navigate(`/markets?q=${encodeURIComponent(t.symbol)}`)}>
                <span className="mover-rank">{i + 1}</span><CoinLogo coin={{ ...t, image: t.small }} size={24} /><b>{t.symbol}</b><span className="muted">{t.name}</span>
                <small className="muted">{t.market_cap_rank ? `#${t.market_cap_rank}` : ""}</small>
              </button></li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Top 100</span><h2>Market breadth</h2></div></div>
          {!insights ? <Skeleton h={120} r={12} /> : (
            <>
              <div className="breadth" role="img" aria-label={`${insights.up} assets up, ${insights.down} down`}>
                <span style={{ width: `${insights.up}%` }} className="breadth-up" />
              </div>
              <div className="breadth-legend"><span className="pct-up">{insights.up} rising</span><span className="pct-down">{insights.down} falling</span></div>
              <ul className="facts">
                <li><span>Most traded</span><b>{insights.byVol.name}</b></li>
                <li><span>Closest to its all-time high (top 50)</span><b>{insights.nearAth.name} · {formatPercent(insights.nearAth.ath_change_percentage, 1)}</b></li>
                <li><span>Highest volume / market cap</span><b>{insights.turnover.name}</b></li>
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
