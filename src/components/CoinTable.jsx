import { memo } from "react";
import { useNavigate } from "react-router-dom";
import CoinLogo from "./CoinLogo";
import Icon from "./Icon";
import { Sparkline } from "./Charts";
import { EmptyState } from "./ui";
import { formatMoneyCompact, formatPercent, formatPrice, tone } from "../lib/format";

export function Pct({ value, digits = 2 }) {
  const t = tone(value);
  return <span className={`pct pct-${t}`}>{formatPercent(value, digits)}</span>;
}

const CoinTable = memo(function CoinTable({
  coins, watchlist, compare, onWatch, onCompare, showSparklines = true, showRank = true, sort, onSort, emptyTitle, emptyText, emptyAction,
  extraColumn,
}) {
  const navigate = useNavigate();
  if (!coins.length) {
    return <EmptyState icon="search" title={emptyTitle ?? "No assets match"} description={emptyText ?? "Try a different search or filter."} action={emptyAction} />;
  }
  const head = (key, label, align) => {
    if (!onSort) return <th className={align}>{label}</th>;
    const active = sort?.by === key;
    return (
      <th className={align} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className={`th-sort ${active ? "active" : ""}`} onClick={() => onSort(key)}>
          {label}
          {active && <Icon name={sort.dir === "asc" ? "arrowUp" : "arrowDown"} size={11} strokeWidth={2} />}
        </button>
      </th>
    );
  };
  return (
    <div className="card table-wrap">
      <table className="coin-table">
        <thead>
          <tr>
            {showRank && head("rank", "#", "num hide-sm")}
            {head("name", "Asset")}
            {head("price", "Price", "num")}
            {head("change", "24h", "num")}
            <th className="num hide-md">7d</th>
            {showSparklines && <th className="hide-lg">Last 7 days</th>}
            {head("marketCap", "Market cap", "num hide-sm")}
            {head("volume", "Volume (24h)", "num hide-md")}
            {extraColumn && <th className="num hide-sm">{extraColumn.label}</th>}
            <th className="actions-col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {coins.map((c) => {
            const watched = watchlist.includes(c.id);
            const comparing = compare.includes(c.id);
            return (
              <tr key={c.id} className="row-link" onClick={(e) => { if (!e.target.closest("button")) navigate(`/coin/${c.id}`); }}>
                {showRank && <td className="num muted hide-sm">{c.market_cap_rank ?? "—"}</td>}
                <td>
                  <button type="button" className="asset-cell" onClick={() => navigate(`/coin/${c.id}`)}>
                    <CoinLogo coin={c} size={30} />
                    <span><b>{c.name}</b><small>{c.symbol.toUpperCase()}</small></span>
                  </button>
                </td>
                <td className="num strong">{formatPrice(c.current_price)}</td>
                <td className="num"><Pct value={c.price_change_percentage_24h} /></td>
                <td className="num hide-md"><Pct value={c.price_change_percentage_7d_in_currency} /></td>
                {showSparklines && <td className="hide-lg"><Sparkline points={c.sparkline_in_7d?.price} /></td>}
                <td className="num hide-sm">{formatMoneyCompact(c.market_cap)}</td>
                <td className="num hide-md">{formatMoneyCompact(c.total_volume)}</td>
                {extraColumn && <td className="num hide-sm">{extraColumn.render(c)}</td>}
                <td className="actions-col">
                  <div className="row-actions">
                    <button type="button" className={`icon-btn ${watched ? "is-on" : ""}`} onClick={() => onWatch(c)} aria-pressed={watched}
                      aria-label={watched ? `Remove ${c.name} from watchlist` : `Add ${c.name} to watchlist`} title={watched ? "In watchlist" : "Add to watchlist"}>
                      <Icon name="star" size={16} className={watched ? "icon-filled" : ""} />
                    </button>
                    <button type="button" className={`icon-btn ${comparing ? "is-on" : ""}`} onClick={() => onCompare(c)} aria-pressed={comparing}
                      aria-label={comparing ? `Remove ${c.name} from compare` : `Add ${c.name} to compare`} title={comparing ? "In compare" : "Add to compare"}>
                      <Icon name="compare" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default CoinTable;
