import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import CoinTable, { Pct } from "../components/CoinTable";
import { ErrorState, PageHeader, EmptyState, TableSkeleton } from "../components/ui";
import { useData } from "../context/DataContext";
import { useSettings } from "../context/SettingsContext";
import { useStore } from "../context/StoreContext";
import { useCoinActions, useDocumentTitle } from "../hooks";
import { DEFAULT_DIR, searchCoins, sortCoins } from "../lib/sort";

export default function Watchlist() {
  useDocumentTitle("Watchlist");
  const { byId, loading, error, refresh, refreshing, fmtKey, coins } = useData();
  const { settings } = useSettings();
  const { watchlist } = useStore();
  const actions = useCoinActions();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ by: "rank", dir: "asc" });

  const saved = useMemo(() => watchlist.map((id) => byId.get(id)).filter(Boolean), [watchlist, byId]);
  const rows = useMemo(() => sortCoins(searchCoins(saved, q), sort.by, sort.dir), [saved, q, sort]);
  const stats = useMemo(() => {
    if (!saved.length) return null;
    const ch = saved.map((c) => c.price_change_percentage_24h).filter(Number.isFinite);
    const avg = ch.length ? ch.reduce((a, b) => a + b, 0) / ch.length : null;
    const byCh = [...saved].filter((c) => Number.isFinite(c.price_change_percentage_24h)).sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    return { avg, best: byCh[0], worst: byCh[byCh.length - 1] };
  }, [saved]);

  const onSort = (by) => setSort((s) => (s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: DEFAULT_DIR[by] ?? "desc" }));

  return (
    <>
      <PageHeader eyebrow="Your market watch" title="Watchlist" description="Assets you're monitoring, with live price and 24-hour movement."
        actions={saved.length > 0 && (
          <label className="search-box"><Icon name="search" size={16} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter your list" aria-label="Filter watchlist" />
          </label>
        )} />

      {loading ? <TableSkeleton rows={5} /> : error && !coins.length ? (
        <ErrorState message={error} onRetry={() => refresh(true)} retrying={refreshing} />
      ) : watchlist.length === 0 ? (
        <EmptyState icon="star" title="Your watchlist is empty" description="Star any asset in Markets to follow its price here. You'll be notified when a watched asset makes a large move."
          action={<Link to="/markets" className="btn btn-primary">Explore markets</Link>} />
      ) : (
        <div data-fmt={fmtKey}>
          {stats && (
            <div className="stats stats-3">
              <div className="stat"><span className="stat-label">Assets watched</span><strong className="stat-value">{saved.length}</strong></div>
              <div className="stat"><span className="stat-label">Average 24h move</span><strong className="stat-value"><Pct value={stats.avg} /></strong></div>
              <div className="stat"><span className="stat-label">Best today</span><strong className="stat-value">{stats.best ? <>{stats.best.symbol.toUpperCase()} <Pct value={stats.best.price_change_percentage_24h} /></> : "—"}</strong>
                {stats.worst && stats.worst !== stats.best && <span className="stat-sub">Weakest: {stats.worst.symbol.toUpperCase()} <Pct value={stats.worst.price_change_percentage_24h} /></span>}</div>
            </div>
          )}
          <CoinTable coins={rows} sort={sort} onSort={onSort} showSparklines={settings.showSparklines} {...actions}
            emptyTitle="No match" emptyText={`Nothing in your watchlist matches “${q}”.`} />
          {saved.length < watchlist.length && <p className="muted small note">{watchlist.length - saved.length} saved asset(s) aren't in the currently loaded market range. Increase market coverage in Settings to see them.</p>}
        </div>
      )}
    </>
  );
}
