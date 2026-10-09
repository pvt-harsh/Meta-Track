import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import CoinLogo from "../components/CoinLogo";
import { Chart } from "../components/Charts";
import { Pct } from "../components/CoinTable";
import { EmptyState, ErrorState, Segmented, Skeleton } from "../components/ui";
import { AlertForm } from "./Alerts";
import { useData } from "../context/DataContext";
import { RANGES, useSettings } from "../context/SettingsContext";
import { useCoinActions, useChart, useDocumentTitle, periodChange } from "../hooks";
import { formatCompact, formatDate, formatMoneyCompact, formatPercent, formatPrice } from "../lib/format";

function Fact({ label, value }) {
  return <div className="fact"><span>{label}</span><b>{value}</b></div>;
}

export default function CoinDetail() {
  const { id } = useParams();
  const { byId, loading, fmtKey } = useData();
  const { settings } = useSettings();
  const actions = useCoinActions();
  const [range, setRange] = useState(settings.defaultRange);
  const [alertOpen, setAlertOpen] = useState(false);
  const coin = byId.get(id);
  const chart = useChart(coin?.id, range);
  const change = periodChange(chart.points);
  useDocumentTitle(coin ? `${coin.name} (${coin.symbol.toUpperCase()})` : "Asset");

  const supplyPct = useMemo(() => (coin?.max_supply ? (coin.circulating_supply / coin.max_supply) * 100 : null), [coin]);

  if (loading && !coin) return <><Skeleton h={48} w="45%" /><div style={{ height: 16 }} /><Skeleton h={380} r={18} /></>;
  if (!coin) {
    return <EmptyState icon="search" title="Asset not found" description="This asset isn't in the market range currently loaded. It may be outside your market coverage setting."
      action={<Link to="/markets" className="btn btn-primary">Back to markets</Link>} />;
  }
  const watched = actions.watchlist.includes(coin.id);
  const comparing = actions.compare.includes(coin.id);

  return (
    <div data-fmt={fmtKey}>
      <Link to="/markets" className="back-link"><Icon name="chevronLeft" size={15} /> Markets</Link>
      <header className="coin-header">
        <div className="coin-title">
          <CoinLogo coin={coin} size={48} />
          <div>
            <span className="eyebrow">Rank #{coin.market_cap_rank}</span>
            <h1>{coin.name} <small>{coin.symbol.toUpperCase()}</small></h1>
          </div>
        </div>
        <div className="coin-price">
          <strong>{formatPrice(coin.current_price)}</strong>
          <Pct value={coin.price_change_percentage_24h} /> <span className="muted small">24h</span>
        </div>
      </header>
      <div className="coin-actions">
        <button type="button" className={`btn ${watched ? "btn-active" : ""}`} onClick={() => actions.onWatch(coin)} aria-pressed={watched}><Icon name="star" size={15} className={watched ? "icon-filled" : ""} />{watched ? "In watchlist" : "Add to watchlist"}</button>
        <button type="button" className={`btn ${comparing ? "btn-active" : ""}`} onClick={() => actions.onCompare(coin)} aria-pressed={comparing}><Icon name="compare" size={15} />{comparing ? "In compare" : "Compare"}</button>
        <button type="button" className="btn" onClick={() => setAlertOpen(true)}><Icon name="bell" size={15} />Create alert</button>
      </div>

      <section className="card">
        <div className="card-head">
          <div><span className="eyebrow">Price history</span><h2>{change != null ? <Pct value={change} /> : "—"} <span className="muted small">over {range}</span></h2></div>
          <Segmented size="sm" label="Range" options={RANGES} value={range} onChange={setRange} />
        </div>
        <div className="detail-chart">
          {chart.loading ? <Skeleton h="100%" r={12} /> : chart.error ? <ErrorState message="This chart couldn't be loaded." onRetry={chart.retry} /> : (
            <Chart series={[{ id: "p", label: coin.name, color: (change ?? 0) >= 0 ? "var(--up)" : "var(--down)", points: chart.points }]} valueFormat={formatPrice} minHeight={300} ariaLabel={`${coin.name} price chart`} />
          )}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Market</span><h2>Key statistics</h2></div></div>
          <div className="facts-grid">
            <Fact label="Market cap" value={formatMoneyCompact(coin.market_cap)} />
            <Fact label="Fully diluted valuation" value={formatMoneyCompact(coin.fully_diluted_valuation)} />
            <Fact label="24h volume" value={formatMoneyCompact(coin.total_volume)} />
            <Fact label="24h range" value={`${formatPrice(coin.low_24h)} – ${formatPrice(coin.high_24h)}`} />
            <Fact label="All-time high" value={`${formatPrice(coin.ath)} (${formatPercent(coin.ath_change_percentage, 1)})`} />
            <Fact label="ATH date" value={formatDate(coin.ath_date)} />
            <Fact label="All-time low" value={formatPrice(coin.atl)} />
            <Fact label="ATL date" value={formatDate(coin.atl_date)} />
          </div>
        </section>
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Performance & supply</span><h2>Returns</h2></div></div>
          <div className="facts-grid">
            <Fact label="1 hour" value={<Pct value={coin.price_change_percentage_1h_in_currency} />} />
            <Fact label="24 hours" value={<Pct value={coin.price_change_percentage_24h} />} />
            <Fact label="7 days" value={<Pct value={coin.price_change_percentage_7d_in_currency} />} />
            <Fact label="30 days" value={<Pct value={coin.price_change_percentage_30d_in_currency} />} />
            <Fact label="Circulating supply" value={`${formatCompact(coin.circulating_supply)} ${coin.symbol.toUpperCase()}`} />
            <Fact label="Max supply" value={coin.max_supply ? `${formatCompact(coin.max_supply)} ${coin.symbol.toUpperCase()}` : "No cap"} />
          </div>
          {supplyPct != null && (
            <div className="supply"><div className="supply-bar"><span style={{ width: `${Math.min(supplyPct, 100)}%` }} /></div><small className="muted">{supplyPct.toFixed(1)}% of max supply is circulating</small></div>
          )}
        </section>
      </div>
      {alertOpen && <AlertForm presetCoin={coin.id} onClose={() => setAlertOpen(false)} />}
    </div>
  );
}
