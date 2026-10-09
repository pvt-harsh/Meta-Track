import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import CoinTable from "../components/CoinTable";
import Pagination from "../components/Pagination";
import { ErrorState, PageHeader, TableSkeleton } from "../components/ui";
import { useData } from "../context/DataContext";
import { useSettings } from "../context/SettingsContext";
import { useCoinActions, useDocumentTitle } from "../hooks";
import { DEFAULT_DIR, searchCoins, sortCoins } from "../lib/sort";
import { formatInt } from "../lib/format";

const FILTERS = [
  ["all", "All assets"],
  ["top10", "Top 10"],
  ["top50", "Top 50"],
  ["top100", "Top 100"],
  ["gainers", "Gainers"],
  ["losers", "Losers"],
  ["watchlist", "Watchlist"],
];

export default function Markets() {
  useDocumentTitle("Markets");
  const { coins, loading, error, refresh, refreshing, fmtKey } = useData();
  const { settings } = useSettings();
  const actions = useCoinActions();
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const filter = FILTERS.some(([v]) => v === params.get("filter")) ? params.get("filter") : "all";
  const sortBy = params.get("sort") ?? settings.defaultSort;
  const dir = params.get("dir") ?? DEFAULT_DIR[sortBy] ?? "desc";
  const pageSize = settings.pageSize;
  const [input, setInput] = useState(q);

  const setParam = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === "" || v == null) next.delete(k); else next.set(k, v);
    }
    if (!keepPage) next.delete("page");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (input === q) return undefined;
    const t = setTimeout(() => setParam({ q: input }), 220);
    return () => clearTimeout(t);
  });
  useEffect(() => setInput(q), [q]);

  const list = useMemo(() => {
    let r = searchCoins(coins, q);
    if (filter === "top10") r = r.filter((c) => c.market_cap_rank <= 10);
    else if (filter === "top50") r = r.filter((c) => c.market_cap_rank <= 50);
    else if (filter === "top100") r = r.filter((c) => c.market_cap_rank <= 100);
    else if (filter === "gainers") r = r.filter((c) => c.price_change_percentage_24h > 0);
    else if (filter === "losers") r = r.filter((c) => c.price_change_percentage_24h < 0);
    else if (filter === "watchlist") r = r.filter((c) => actions.watchlist.includes(c.id));
    return sortCoins(r, sortBy, dir);
  }, [coins, q, filter, sortBy, dir, actions.watchlist]);

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, parseInt(params.get("page"), 10) || 1), pageCount);
  const rows = list.slice((page - 1) * pageSize, page * pageSize);

  function onSort(key) {
    const nextDir = sortBy === key ? (dir === "asc" ? "desc" : "asc") : (DEFAULT_DIR[key] ?? "desc");
    setParam({ sort: key, dir: nextDir });
  }

  function goTo(n) {
    setParam({ page: n > 1 ? String(n) : "" }, true);
    document.getElementById("markets-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <PageHeader eyebrow="Markets" title="Explore the market"
        description={coins.length ? `${formatInt(coins.length)} assets ranked by market cap. Search, filter and sort to find what's worth watching.` : "Search, filter and sort every tracked asset."}
        actions={
          <label className="search-box">
            <Icon name="search" size={16} />
            <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search name, symbol or rank" aria-label="Search assets" />
          </label>
        } />

      <div className="toolbar" id="markets-top">
        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.map(([v, l]) => (
            <button key={v} type="button" className={`chip ${filter === v ? "active" : ""}`} aria-pressed={filter === v} onClick={() => setParam({ filter: v === "all" ? "" : v })}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <TableSkeleton rows={10} /> : error && !coins.length ? (
        <ErrorState message={error} onRetry={() => refresh(true)} retrying={refreshing} />
      ) : (
        <div data-fmt={fmtKey}>
          <CoinTable coins={rows} sort={{ by: sortBy, dir }} onSort={onSort} showSparklines={settings.showSparklines} {...actions}
            emptyTitle={filter === "watchlist" ? "Your watchlist is empty" : "No assets match"}
            emptyText={filter === "watchlist" ? "Star an asset to see it here." : "Try a different name, symbol or filter."}
            emptyAction={(q || filter !== "all") && <button type="button" className="btn btn-sm" onClick={() => { setInput(""); setParams({}, { replace: true }); }}>Clear filters</button>} />
          <Pagination page={page} pageCount={pageCount} totalItems={list.length} pageSize={pageSize} onChange={goTo} />
        </div>
      )}
    </>
  );
}
