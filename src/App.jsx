import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./App.css";
import profileImage from "./assets/profile.jpg";

import {
  clearApiCache,
  getCoinChart,
  getGlobalMarket,
  getMarkets,
  getTrending,
} from "./services/cryptoApi";

const CREATOR_INSTAGRAM = "https://www.instagram.com/_pvt.hash/";
const COIN_LIMIT = 1000;
const PAGE_SIZE = 20;
const CHART_RANGES = ["1H", "24H", "7D", "30D", "1Y", "MAX"];

// Regional / currency options. All are real vs_currency codes CoinGecko
// supports, so switching one actually re-fetches live data in that
// currency rather than just relabeling USD numbers.
const CURRENCIES = [
  { code: "usd", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "eur", label: "Euro", symbol: "€", locale: "de-DE" },
  { code: "gbp", label: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "inr", label: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "jpy", label: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
  { code: "aud", label: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "cad", label: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
  { code: "sgd", label: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "aed", label: "UAE Dirham", symbol: "AED", locale: "ar-AE" },
  { code: "brl", label: "Brazilian Real", symbol: "R$", locale: "pt-BR" },
  { code: "zar", label: "South African Rand", symbol: "R", locale: "en-ZA" },
  { code: "krw", label: "South Korean Won", symbol: "₩", locale: "ko-KR" },
];

function currencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

// Module-level "current currency", kept in sync with the persisted
// currency state below. Format helpers read it synchronously so every
// call site doesn't need to thread a currency prop through every layer.
let ACTIVE_CURRENCY = readStorage("metatrack-currency", "usd");

function cs() {
  return currencyMeta(ACTIVE_CURRENCY).symbol;
}

const FILTERS = [
  ["all", "All coins"],
  ["favorites", "Watchlist"],
  ["top10", "Top 10"],
  ["top50", "Top 50"],
  ["top100", "Top 100"],
  ["gainers", "Gainers"],
  ["losers", "Losers"],
];

const SORTS = [
  ["rank", "Rank"],
  ["name", "Name"],
  ["price", "Price"],
  ["change", "24h %"],
  ["marketCap", "Market cap"],
  ["volume", "Volume"],
];

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: IconHome },
  { id: "markets", label: "Markets", icon: IconMarkets },
  { id: "watchlist", label: "Watchlist", icon: IconStar },
  { id: "compare", label: "Compare", icon: IconCompare },
  { id: "portfolio", label: "Portfolio", icon: IconPortfolio },
  { id: "alerts", label: "Alerts", icon: IconBell },
  { id: "settings", label: "Settings", icon: IconSettings },
];

/* -------------------------------------------------------------------- */
/*  Storage helpers                                                     */
/* -------------------------------------------------------------------- */

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable.
  }
}

/* -------------------------------------------------------------------- */
/*  Formatters                                                          */
/* -------------------------------------------------------------------- */

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  const number = Number(value);
  const meta = currencyMeta(ACTIVE_CURRENCY);
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code.toUpperCase(),
    maximumFractionDigits: Math.abs(number) < 1 ? 8 : 2,
  }).format(number);
}

function formatCompact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    Number(value)
  );
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function changeClass(value) {
  return Number(value) >= 0 ? "positive" : "negative";
}

function PercentCell({ value }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className="muted-cell">N/A</span>;
  }
  return <span className={changeClass(value)}>{formatPercent(value)}</span>;
}

function numOrNull(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

// Fallback computation for 1h/7d/30d/1y % change, used whenever CoinGecko's
// markets endpoint doesn't return the `_in_currency` fields for those
// ranges (this happens on the public/anonymous tier, which doesn't always
// honor the multi-range price_change_percentage query parameter). Derives
// the change from real historical price series already fetched for the
// Compare page's mini-charts — never fabricated, just computed from actual
// data points closest to "now minus N".
function percentChangeAt(series, msAgo) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const last = series[series.length - 1];
  const targetTime = last[0] - msAgo;

  let closest = series[0];
  let minDiff = Math.abs(series[0][0] - targetTime);
  for (const point of series) {
    const diff = Math.abs(point[0] - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  const startPrice = closest[1];
  const endPrice = last[1];
  if (!startPrice) return null;
  return ((endPrice - startPrice) / startPrice) * 100;
}

// The Compare page's full metrics table. Every field here comes straight
// from the /coins/markets payload already loaded into `coins` — nothing
// is invented. `highlight: true` marks rows where the row-level "leading
// value" gold highlight applies (skipped for dates and ATL, since a
// lower ATL isn't a meaningful "win").
function buildCompareMetricRows(compareStats = {}) {
  const statFor = (coin) => compareStats[coin.id] ?? {};

  return [
    {
      label: "Market cap rank",
      get: (c) => numOrNull(c.market_cap_rank),
      fmt: (c) => (c.market_cap_rank ? `#${c.market_cap_rank}` : "N/A"),
      highlight: false,
    },
    {
      label: "Price",
      get: (c) => numOrNull(c.current_price),
      fmt: (c) => formatCurrency(c.current_price),
      highlight: true,
    },
    {
      label: "1h change",
      get: (c) => numOrNull(c.price_change_percentage_1h_in_currency ?? statFor(c).h1),
      fmt: (c) => <PercentCell value={c.price_change_percentage_1h_in_currency ?? statFor(c).h1} />,
      highlight: true,
    },
    {
      label: "24h change",
      get: (c) => numOrNull(c.price_change_percentage_24h),
      fmt: (c) => <PercentCell value={c.price_change_percentage_24h} />,
      highlight: true,
    },
    {
      label: "7d change",
      get: (c) => numOrNull(c.price_change_percentage_7d_in_currency ?? statFor(c).d7),
      fmt: (c) => <PercentCell value={c.price_change_percentage_7d_in_currency ?? statFor(c).d7} />,
      highlight: true,
    },
    {
      label: "30d change",
      get: (c) => numOrNull(c.price_change_percentage_30d_in_currency ?? statFor(c).d30),
      fmt: (c) => <PercentCell value={c.price_change_percentage_30d_in_currency ?? statFor(c).d30} />,
      highlight: true,
    },
    {
      label: "1y change",
      get: (c) => numOrNull(c.price_change_percentage_1y_in_currency ?? statFor(c).y1),
      fmt: (c) => <PercentCell value={c.price_change_percentage_1y_in_currency ?? statFor(c).y1} />,
      highlight: true,
    },
    {
      label: "24h high",
      get: (c) => numOrNull(c.high_24h),
      fmt: (c) => formatCurrency(c.high_24h),
      highlight: true,
    },
    {
      label: "24h low",
      get: (c) => numOrNull(c.low_24h),
      fmt: (c) => formatCurrency(c.low_24h),
      highlight: true,
    },
    {
      label: "Market cap",
      get: (c) => numOrNull(c.market_cap),
      fmt: (c) => `${cs()}${formatCompact(c.market_cap)}`,
      highlight: true,
    },
    {
      label: "Market cap change (24h)",
      get: (c) => numOrNull(c.market_cap_change_percentage_24h),
      fmt: (c) => <PercentCell value={c.market_cap_change_percentage_24h} />,
      highlight: true,
    },
    {
      label: "Fully diluted valuation",
      get: (c) => numOrNull(c.fully_diluted_valuation),
      fmt: (c) => (c.fully_diluted_valuation ? `${cs()}${formatCompact(c.fully_diluted_valuation)}` : "N/A"),
      highlight: true,
    },
    {
      label: "24h volume",
      get: (c) => numOrNull(c.total_volume),
      fmt: (c) => `${cs()}${formatCompact(c.total_volume)}`,
      highlight: true,
    },
    {
      label: "Volume ÷ market cap",
      get: (c) => (c.market_cap ? c.total_volume / c.market_cap : null),
      fmt: (c) => (c.market_cap ? `${((c.total_volume / c.market_cap) * 100).toFixed(2)}%` : "N/A"),
      highlight: true,
    },
    {
      label: "Circulating supply",
      get: (c) => numOrNull(c.circulating_supply),
      fmt: (c) => (c.circulating_supply ? `${formatCompact(c.circulating_supply)} ${c.symbol.toUpperCase()}` : "N/A"),
      highlight: true,
    },
    {
      label: "Total supply",
      get: (c) => numOrNull(c.total_supply),
      fmt: (c) => (c.total_supply ? `${formatCompact(c.total_supply)} ${c.symbol.toUpperCase()}` : "N/A"),
      highlight: true,
    },
    {
      label: "Max supply",
      get: (c) => numOrNull(c.max_supply),
      fmt: (c) => (c.max_supply ? `${formatCompact(c.max_supply)} ${c.symbol.toUpperCase()}` : "No max"),
      highlight: true,
    },
    {
      label: "% of max supply circulating",
      get: (c) => (c.max_supply ? (c.circulating_supply / c.max_supply) * 100 : null),
      fmt: (c) => (c.max_supply ? `${((c.circulating_supply / c.max_supply) * 100).toFixed(1)}%` : "N/A"),
      highlight: true,
    },
    {
      label: "All-time high",
      get: (c) => numOrNull(c.ath),
      fmt: (c) => formatCurrency(c.ath),
      highlight: true,
    },
    {
      label: "Change from ATH",
      get: (c) => numOrNull(c.ath_change_percentage),
      fmt: (c) => <PercentCell value={c.ath_change_percentage} />,
      highlight: true,
    },
    {
      label: "ATH date",
      get: () => null,
      fmt: (c) => (c.ath_date ? new Date(c.ath_date).toLocaleDateString() : "N/A"),
      highlight: false,
    },
    {
      label: "All-time low",
      get: () => null,
      fmt: (c) => formatCurrency(c.atl),
      highlight: false,
    },
    {
      label: "Change from ATL",
      get: () => null,
      fmt: (c) => <PercentCell value={c.atl_change_percentage} />,
      highlight: false,
    },
    {
      label: "ATL date",
      get: () => null,
      fmt: (c) => (c.atl_date ? new Date(c.atl_date).toLocaleDateString() : "N/A"),
      highlight: false,
    },
    {
      label: "Last updated",
      get: () => null,
      fmt: (c) => (c.last_updated ? new Date(c.last_updated).toLocaleString() : "N/A"),
      highlight: false,
    },
  ];
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* -------------------------------------------------------------------- */
/*  Icons (inline SVG, single stroke, no external assets)               */
/* -------------------------------------------------------------------- */

function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9h12v-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconMarkets(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 19V10M11 19V5M18 19v-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconStar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="m12 4 2.3 5.1 5.6.6-4.2 3.8 1.2 5.5L12 16.2 6.9 19l1.3-5.5-4.2-3.8 5.6-.6L12 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCompare(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M8 6h13M8 6 4 10M8 6 4 2M16 18H3M16 18l4-4M16 18l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconPortfolio(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect
        x="3.5"
        y="7"
        width="17"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function IconBell(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.2 1.5 5.2H4.5S6 14 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconSettings(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.7a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.3a7 7 0 0 0-2 1.2l-2.4-.7-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.7a7 7 0 0 0 2 1.2L10 21h4l.5-2.3a7 7 0 0 0 2-1.2l2.4.7 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSearch(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m20 20-4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------- */
/*  Shared presentational pieces                                        */
/* -------------------------------------------------------------------- */

function CoinLogo({ coin, size = 40 }) {
  const [failed, setFailed] = useState(false);

  if (failed || !coin?.image) {
    return (
      <span
        className="coin-fallback"
        style={{ width: size, height: size, fontSize: size * 0.34 }}
      >
        {coin?.symbol?.slice(0, 2).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      className="coin-logo"
      src={coin.image}
      alt={`${coin.name} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function SkeletonRows({ count = 8 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </div>
  );
}

function StatTile({ label, value, sub, tone }) {
  return (
    <article className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <strong className="stat-tile-value">{value}</strong>
      {sub !== undefined && sub !== null && (
        <small className={`stat-tile-sub ${tone ?? ""}`}>{sub}</small>
      )}
    </article>
  );
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function Chart({ points, positive }) {
  const values = points.map((item) => Number(item[1])).filter(Number.isFinite);

  if (values.length < 2) {
    return <div className="chart-empty">Historical chart data is unavailable.</div>;
  }

  const width = 1000;
  const height = 320;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coordinates = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 12 - ((value - min) / range) * (height - 32);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Historical price chart"
    >
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "#c9a35a" : "#b1554a"} stopOpacity="0.4" />
          <stop offset="100%" stopColor={positive ? "#c9a35a" : "#b1554a"} stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <line className="chart-grid" x1="0" y1="80" x2={width} y2="80" />
      <line className="chart-grid" x1="0" y1="160" x2={width} y2="160" />
      <line className="chart-grid" x1="0" y1="240" x2={width} y2="240" />
      <polygon className="chart-fill" points={`0,${height} ${coordinates} ${width},${height}`} />
      <polyline
        className={`chart-path ${positive ? "up" : "down"}`}
        points={coordinates}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------- */
/*  Sidebar + top bar                                                   */
/* -------------------------------------------------------------------- */

function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand-row">
        <button
          className="brand"
          type="button"
          onClick={() => setPage("home")}
        >
          <img className="brand-mark" src="/favicon.png" alt="MetaTrack" />
          {!collapsed && (
            <span className="brand-text">
              <b>MetaTrack</b>
              <small>Track · Compare · Explore</small>
            </span>
          )}
        </button>
        <button
          className="collapse-toggle"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="side-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`side-nav-item ${page === id ? "active" : ""}`}
            onClick={() => setPage(id)}
          >
            <Icon className="side-nav-icon" />
            {!collapsed && <span>{label}</span>}
            {page === id && <span className="side-nav-indicator" />}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="sidebar-footer"
        onClick={() => setPage("settings")}
      >
        <img src={profileImage} alt="Harsh Kumar" />
        {!collapsed && (
          <span>
            <b>Harsh Kumar</b>
            <small>Creator</small>
          </span>
        )}
      </button>
    </aside>
  );
}

function Topbar({
  search,
  setSearch,
  onOpenPalette,
  darkMode,
  setDarkMode,
  refreshing,
  onRefresh,
  alertCount,
  onOpenAlerts,
}) {
  return (
    <header className="topbar">
      <button className="command-search" type="button" onClick={onOpenPalette}>
        <IconSearch className="command-search-icon" />
        <span>Search coin, symbol or page…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar-actions">
        <button
          className="icon-pill"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh market data"
          title="Refresh market data"
        >
          {refreshing ? "…" : "↻"}
        </button>

        <button
          className="icon-pill"
          type="button"
          onClick={() => setDarkMode((v) => !v)}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {darkMode ? "☾" : "☀"}
        </button>

        <button
          className="icon-pill"
          type="button"
          onClick={onOpenAlerts}
          aria-label={alertCount > 0 ? `${alertCount} active alerts` : "Alerts"}
          title="View alerts"
        >
          <IconBell className="bell-icon" />
          {alertCount > 0 && <span className="pill-badge">{alertCount}</span>}
        </button>

        <img className="topbar-avatar" src={profileImage} alt="Harsh Kumar" />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- */
/*  Command palette                                                     */
/* -------------------------------------------------------------------- */

function CommandPalette({ open, onClose, coins, setPage, onOpenCoin, search, setSearch }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const term = search.trim().toLowerCase();

  const matchedCoins = term
    ? coins
        .filter(
          (coin) =>
            coin.name.toLowerCase().includes(term) ||
            coin.symbol.toLowerCase().includes(term)
        )
        .slice(0, 6)
    : [];

  const matchedPages = NAV_ITEMS.filter((item) =>
    term ? item.label.toLowerCase().includes(term) : true
  );

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="command-palette" role="dialog" aria-modal="true">
        <div className="command-input-row">
          <IconSearch className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search coins or jump to a page…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <kbd>Esc</kbd>
        </div>

        {matchedPages.length > 0 && (
          <div className="command-section">
            <span className="command-section-label">Go to</span>
            {matchedPages.map((item) => (
              <button
                key={item.id}
                type="button"
                className="command-row"
                onClick={() => {
                  setPage(item.id);
                  onClose();
                }}
              >
                <item.icon className="command-row-icon" />
                {item.label}
              </button>
            ))}
          </div>
        )}

        {matchedCoins.length > 0 && (
          <div className="command-section">
            <span className="command-section-label">Coins</span>
            {matchedCoins.map((coin) => (
              <button
                key={coin.id}
                type="button"
                className="command-row"
                onClick={() => {
                  onOpenCoin(coin);
                  onClose();
                }}
              >
                <CoinLogo coin={coin} size={22} />
                <span>{coin.name}</span>
                <small>{coin.symbol.toUpperCase()}</small>
                <strong>{formatCurrency(coin.current_price)}</strong>
              </button>
            ))}
          </div>
        )}

        {term && matchedCoins.length === 0 && matchedPages.length === 0 && (
          <div className="command-empty">No matches for "{search}".</div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Markets table (shared by Home preview, Markets, Watchlist)          */
/* -------------------------------------------------------------------- */

function MarketsTable({ coins, watchlist, onOpen, onWatch, onCompare, compareCoins }) {
  if (coins.length === 0) {
    return (
      <EmptyState
        icon="⌕"
        title="No coins match"
        description="Try a different name, symbol or filter."
      />
    );
  }

  return (
    <div className="markets-table-wrapper">
      <table className="markets-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Coin</th>
            <th>Price</th>
            <th>24h</th>
            <th>Market cap</th>
            <th>Volume (24h)</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <tr key={coin.id}>
              <td className="muted-cell">{coin.market_cap_rank ?? "—"}</td>
              <td>
                <button className="table-coin" type="button" onClick={() => onOpen(coin)}>
                  <CoinLogo coin={coin} size={30} />
                  <span>
                    <b>{coin.name}</b>
                    <small>{coin.symbol.toUpperCase()}</small>
                  </span>
                </button>
              </td>
              <td>{formatCurrency(coin.current_price)}</td>
              <td className={changeClass(coin.price_change_percentage_24h)}>
                {formatPercent(coin.price_change_percentage_24h)}
              </td>
              <td>{cs()}{formatCompact(coin.market_cap)}</td>
              <td>{cs()}{formatCompact(coin.total_volume)}</td>
              <td>
                <div className="table-actions">
                  <button
                    type="button"
                    className={`icon-button ${watchlist.includes(coin.id) ? "active" : ""}`}
                    onClick={() => onWatch(coin.id)}
                    aria-label="Toggle watchlist"
                  >
                    <IconStar className="star-icon" />
                  </button>
                  <button
                    type="button"
                    className={`chip-button ${compareCoins.includes(coin.id) ? "selected" : ""}`}
                    onClick={() => onCompare(coin.id)}
                  >
                    {compareCoins.includes(coin.id) ? "Added" : "Compare"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Pagination                                                          */
/* -------------------------------------------------------------------- */

// Builds the visible page buttons, e.g. 1 … 4 5 6 … 50
function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap-end", total];
  if (current >= total - 3) {
    return [1, "gap-start", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "gap-start", current - 1, current, current + 1, "gap-end", total];
}

function Pagination({ page, pageCount, totalItems, pageSize, onChange }) {
  const [jump, setJump] = useState("");

  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  function submitJump(event) {
    event.preventDefault();
    const target = Number(jump);
    if (Number.isInteger(target) && target >= 1 && target <= pageCount) {
      onChange(target);
      setJump("");
    }
  }

  return (
    <nav className="pagination" aria-label="Markets pages">
      <span className="pagination-summary">
        Showing {first}–{last} of {totalItems} · Page {page} of {pageCount}
      </span>

      <div className="pagination-pages">
        <button
          type="button"
          className="page-btn page-btn-edge"
          onClick={() => onChange(1)}
          disabled={page === 1}
          aria-label="First page"
          title="First page"
        >
          «
        </button>

        <button
          type="button"
          className="page-btn page-btn-nav"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        {getPageItems(page, pageCount).map((item) =>
          typeof item === "string" ? (
            <span className="page-gap" key={item}>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`page-btn ${item === page ? "active" : ""}`}
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          className="page-btn page-btn-nav"
          onClick={() => onChange(page + 1)}
          disabled={page === pageCount}
          aria-label="Next page"
        >
          Next ›
        </button>

        <button
          type="button"
          className="page-btn page-btn-edge"
          onClick={() => onChange(pageCount)}
          disabled={page === pageCount}
          aria-label="Last page"
          title="Last page"
        >
          »
        </button>
      </div>

      <form className="pagination-jump" onSubmit={submitJump}>
        <label htmlFor="page-jump">Go to page</label>
        <input
          id="page-jump"
          type="number"
          min="1"
          max={pageCount}
          value={jump}
          onChange={(event) => setJump(event.target.value)}
          placeholder={`1–${pageCount}`}
        />
        <button type="submit" className="page-btn">
          Go
        </button>
      </form>
    </nav>
  );
}

/* -------------------------------------------------------------------- */
/*  App                                                                  */
/* -------------------------------------------------------------------- */

function App() {
  const [page, setPage] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [coins, setCoins] = useState([]);
  const [globalMarket, setGlobalMarket] = useState(null);
  const [trending, setTrending] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("rank");
  const [sortDirection, setSortDirection] = useState("asc");
  const [marketPage, setMarketPage] = useState(1);

  const [darkMode, setDarkMode] = useState(() => readStorage("metatrack-theme", true));
  const [currency, setCurrency] = useState(() => readStorage("metatrack-currency", "usd"));
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(() =>
    readStorage("metatrack-refresh-interval", 60_000)
  );
  const [defaultChartRange, setDefaultChartRange] = useState(() =>
    readStorage("metatrack-default-range", "7D")
  );
  const [watchlist, setWatchlist] = useState(() => readStorage("metatrack-watchlist", []));
  const [compareCoins, setCompareCoins] = useState([]);
  const [compareSearch, setCompareSearch] = useState("");
  const [compareRange, setCompareRange] = useState("7D");
  const [compareCharts, setCompareCharts] = useState({});
  const [compareChartsLoading, setCompareChartsLoading] = useState(false);
  const [compareStats, setCompareStats] = useState({});
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [chartRange, setChartRange] = useState(() => readStorage("metatrack-default-range", "7D"));
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [heroCoinId, setHeroCoinId] = useState("bitcoin");
  const [heroRange, setHeroRange] = useState(() => readStorage("metatrack-default-range", "7D"));
  const [heroChart, setHeroChart] = useState([]);
  const [heroChartLoading, setHeroChartLoading] = useState(false);

  const [portfolio, setPortfolio] = useState(() => readStorage("metatrack-portfolio", []));
  const [alerts, setAlerts] = useState(() => readStorage("metatrack-alerts", []));

  const [portfolioForm, setPortfolioForm] = useState({ coinId: "", quantity: "", buyPrice: "" });
  const [alertForm, setAlertForm] = useState({ coinId: "", condition: "above", price: "" });
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [moversTab, setMoversTab] = useState("gainers");

  const [notice, setNotice] = useState("");

  const refreshData = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setRefreshing(true);
        clearApiCache();
      }
      setError("");

      const [marketData, globalData, trendingData] = await Promise.all([
        getMarkets({ force: manual, currency, pages: 4 }),
        getGlobalMarket({ force: manual }),
        getTrending({ force: manual }),
      ]);

      if (!Array.isArray(marketData) || marketData.length === 0) {
        throw new Error("No cryptocurrency market data was returned.");
      }

      const limitedCoins = marketData
  .filter((coin) => coin && coin.id && coin.name && coin.symbol && coin.market_cap_rank != null)
  .sort((a, b) => (a.market_cap_rank ?? 999999) - (b.market_cap_rank ?? 999999))
  .slice(0, COIN_LIMIT);

      setCoins(limitedCoins);
      setGlobalMarket(globalData?.data ?? null);
      setTrending((trendingData?.coins ?? []).slice(0, 7));

      setSelectedCoin((current) =>
        current ? limitedCoins.find((coin) => coin.id === current.id) ?? current : null
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to load cryptocurrency data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currency]);

  useEffect(() => {
    refreshData();
    if (!refreshIntervalMs) return undefined;
    const timer = setInterval(() => refreshData(), refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refreshData, refreshIntervalMs]);

  useEffect(() => writeStorage("metatrack-refresh-interval", refreshIntervalMs), [refreshIntervalMs]);
  useEffect(() => writeStorage("metatrack-default-range", defaultChartRange), [defaultChartRange]);

  // Re-fetch in the newly selected currency (skip the very first mount,
  // which the effect above already handles).
  const didMountCurrency = useRef(false);
  useEffect(() => {
    if (!didMountCurrency.current) {
      didMountCurrency.current = true;
      return;
    }
    setLoading(true);
    refreshData(true);
  }, [currency]);

  useEffect(() => writeStorage("metatrack-theme", darkMode), [darkMode]);
  useEffect(() => writeStorage("metatrack-currency", currency), [currency]);
  useEffect(() => writeStorage("metatrack-watchlist", watchlist), [watchlist]);
  useEffect(() => writeStorage("metatrack-portfolio", portfolio), [portfolio]);
  useEffect(() => writeStorage("metatrack-alerts", alerts), [alerts]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Global Ctrl/Cmd+K shortcut for the command palette.
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Coin detail modal chart.
  useEffect(() => {
    if (!selectedCoin) return;
    let cancelled = false;

    async function loadChart() {
      try {
        setChartLoading(true);
        setChartData([]);
        const data = await getCoinChart(selectedCoin.id, chartRange, currency);
        if (!cancelled) setChartData(Array.isArray(data?.prices) ? data.prices : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setChartData([]);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }
    loadChart();
    return () => {
      cancelled = true;
    };
  }, [selectedCoin, chartRange, currency]);

  // Home hero spotlight chart (defaults to Bitcoin).
  useEffect(() => {
    let cancelled = false;

    async function loadHeroChart() {
      try {
        setHeroChartLoading(true);
        const data = await getCoinChart(heroCoinId, heroRange, currency);
        if (!cancelled) setHeroChart(Array.isArray(data?.prices) ? data.prices : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setHeroChart([]);
      } finally {
        if (!cancelled) setHeroChartLoading(false);
      }
    }
    loadHeroChart();
    return () => {
      cancelled = true;
    };
  }, [heroCoinId, heroRange, currency]);

  // Compare page mini-charts — fetch real history for every selected coin.
  useEffect(() => {
    if (compareCoins.length === 0) {
      setCompareCharts({});
      return;
    }
    let cancelled = false;

    async function loadCompareCharts() {
      setCompareChartsLoading(true);
      try {
        const entries = await Promise.all(
          compareCoins.map(async (id) => {
            try {
              const data = await getCoinChart(id, compareRange, currency);
              return [id, Array.isArray(data?.prices) ? data.prices : []];
            } catch (err) {
              console.error(err);
              return [id, []];
            }
          })
        );
        if (!cancelled) setCompareCharts(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setCompareChartsLoading(false);
      }
    }

    loadCompareCharts();
    return () => {
      cancelled = true;
    };
  }, [compareCoins, compareRange, currency]);

  // Real 1h/7d/30d/1y % change for the Compare table, computed from actual
  // historical price series (see percentChangeAt) — a fallback for when
  // the markets endpoint doesn't return the `_in_currency` fields.
  // Independent of the mini-chart range toggle so it only runs once per
  // coin selection / currency change, not on every range click.
  useEffect(() => {
    if (compareCoins.length === 0) {
      setCompareStats({});
      return;
    }
    let cancelled = false;

    async function loadStats() {
      try {
        const entries = await Promise.all(
          compareCoins.map(async (id) => {
            try {
              const [shortData, longData] = await Promise.all([
                getCoinChart(id, "24H", currency),
                getCoinChart(id, "1Y", currency),
              ]);
              const shortSeries = Array.isArray(shortData?.prices) ? shortData.prices : [];
              const longSeries = Array.isArray(longData?.prices) ? longData.prices : [];

              return [
                id,
                {
                  h1: percentChangeAt(shortSeries, 60 * 60 * 1000),
                  d7: percentChangeAt(longSeries, 7 * 24 * 60 * 60 * 1000),
                  d30: percentChangeAt(longSeries, 30 * 24 * 60 * 60 * 1000),
                  y1: percentChangeAt(longSeries, 365 * 24 * 60 * 60 * 1000),
                },
              ];
            } catch (err) {
              console.error(err);
              return [id, { h1: null, d7: null, d30: null, y1: null }];
            }
          })
        );
        if (!cancelled) setCompareStats(Object.fromEntries(entries));
      } catch (err) {
        console.error(err);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [compareCoins, currency]);

  // Price alert evaluation whenever fresh data arrives.
  useEffect(() => {
    if (!coins.length || !alerts.length) return;
    let changed = false;

    const nextAlerts = alerts.map((alert) => {
      if (alert.triggered) return alert;
      const coin = coins.find((item) => item.id === alert.coinId);
      if (!coin) return alert;

      const price = Number(coin.current_price);
      const target = Number(alert.price);
      const triggered = alert.condition === "above" ? price >= target : price <= target;

      if (triggered) {
        changed = true;
        setNotice(`${coin.name} price alert triggered.`);
        return { ...alert, triggered: true, triggeredAt: new Date().toISOString() };
      }
      return alert;
    });

    if (changed) setAlerts(nextAlerts);
  }, [coins, alerts]);

  const toggleWatchlist = useCallback((coinId) => {
    setWatchlist((current) =>
      current.includes(coinId) ? current.filter((id) => id !== coinId) : [...current, coinId]
    );
  }, []);

  const toggleCompare = useCallback((coinId) => {
    setCompareCoins((current) => {
      if (current.includes(coinId)) return current.filter((id) => id !== coinId);
      if (current.length >= 3) {
        setNotice("You can compare up to 3 cryptocurrencies.");
        return current;
      }
      return [...current, coinId];
    });
  }, []);

  const compareData = useMemo(
    () => compareCoins.map((id) => coins.find((coin) => coin.id === id)).filter(Boolean),
    [coins, compareCoins]
  );

  const filteredCoins = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = coins;

    if (term) {
      result = result.filter((coin) => {
        const name = coin.name?.toLowerCase() ?? "";
        const symbol = coin.symbol?.toLowerCase() ?? "";
        const rank = String(coin.market_cap_rank ?? "");
        return name.includes(term) || symbol.includes(term) || rank === term;
      });
    }

    switch (filter) {
      case "favorites":
        result = result.filter((coin) => watchlist.includes(coin.id));
        break;
      case "top10":
        result = result.filter((coin) => (coin.market_cap_rank ?? 999) <= 10);
        break;
      case "top50":
        result = result.filter((coin) => (coin.market_cap_rank ?? 999) <= 50);
        break;
      case "top100":
        result = result.filter((coin) => (coin.market_cap_rank ?? 999) <= 100);
        break;
      case "gainers":
        result = result.filter((coin) => Number(coin.price_change_percentage_24h) > 0);
        break;
      case "losers":
        result = result.filter((coin) => Number(coin.price_change_percentage_24h) < 0);
        break;
      default:
        break;
    }

    return [...result].sort((a, b) => {
      let left;
      let right;
      switch (sortBy) {
        case "name":
          left = a.name?.toLowerCase();
          right = b.name?.toLowerCase();
          break;
        case "price":
          left = Number(a.current_price ?? 0);
          right = Number(b.current_price ?? 0);
          break;
        case "change":
          left = Number(a.price_change_percentage_24h ?? 0);
          right = Number(b.price_change_percentage_24h ?? 0);
          break;
        case "marketCap":
          left = Number(a.market_cap ?? 0);
          right = Number(b.market_cap ?? 0);
          break;
        case "volume":
          left = Number(a.total_volume ?? 0);
          right = Number(b.total_volume ?? 0);
          break;
        default:
          left = a.market_cap_rank ?? 999999;
          right = b.market_cap_rank ?? 999999;
      }
      if (typeof left === "string" && typeof right === "string") {
        return sortDirection === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }
      return sortDirection === "asc" ? left - right : right - left;
    });
  }, [coins, filter, search, sortBy, sortDirection, watchlist]);

  // Markets pagination: 20 coins per page.
  const marketPageCount = Math.max(1, Math.ceil(filteredCoins.length / PAGE_SIZE));
  const currentMarketPage = Math.min(marketPage, marketPageCount);
  const pagedCoins = filteredCoins.slice(
    (currentMarketPage - 1) * PAGE_SIZE,
    currentMarketPage * PAGE_SIZE
  );

  // Go back to page 1 whenever the search, filter or sort changes.
  useEffect(() => {
    setMarketPage(1);
  }, [search, filter, sortBy, sortDirection]);

  // Read ?page= once on mount, so a shared or refreshed link opens on the
  // right page instead of always resetting to page 1.
  useEffect(() => {
    const urlPage = parseInt(new URLSearchParams(window.location.search).get("page"), 10);
    if (Number.isInteger(urlPage) && urlPage > 0) {
      setMarketPage(urlPage);
    }
  }, []);

  // Keep ?page= in sync with the current Markets page (replaceState, so
  // clicking through pages doesn't flood the back-button history), and
  // react to the browser's own Back/Forward buttons.
  useEffect(() => {
    if (page !== "markets") return;
    const params = new URLSearchParams(window.location.search);
    if (currentMarketPage > 1) {
      params.set("page", String(currentMarketPage));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({ marketPage: currentMarketPage }, "", newUrl);
  }, [page, currentMarketPage]);

  useEffect(() => {
    function handlePopState() {
      const urlPage = parseInt(new URLSearchParams(window.location.search).get("page"), 10);
      setMarketPage(Number.isInteger(urlPage) && urlPage > 0 ? urlPage : 1);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function goToMarketPage(nextPage) {
    const clamped = Math.min(Math.max(1, nextPage), marketPageCount);
    setMarketPage(clamped);
    document.getElementById("markets-table-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const gainers = useMemo(
    () =>
      [...coins]
        .sort((a, b) => Number(b.price_change_percentage_24h ?? 0) - Number(a.price_change_percentage_24h ?? 0))
        .slice(0, 5),
    [coins]
  );

  const losers = useMemo(
    () =>
      [...coins]
        .sort((a, b) => Number(a.price_change_percentage_24h ?? 0) - Number(b.price_change_percentage_24h ?? 0))
        .slice(0, 5),
    [coins]
  );

  const totalInvested = useMemo(
    () => portfolio.reduce((sum, item) => sum + Number(item.quantity) * Number(item.buyPrice), 0),
    [portfolio]
  );

  const currentPortfolioValue = useMemo(
    () =>
      portfolio.reduce((sum, item) => {
        const coin = coins.find((c) => c.id === item.coinId);
        return sum + (coin ? Number(item.quantity) * Number(coin.current_price) : 0);
      }, 0),
    [portfolio, coins]
  );

  const portfolioProfit = currentPortfolioValue - totalInvested;

  function handleSort(value) {
    if (sortBy === value) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(value);
      setSortDirection(value === "name" ? "asc" : "desc");
    }
  }

  function addPortfolioPosition(event) {
    event.preventDefault();
    const quantity = Number(portfolioForm.quantity);
    const buyPrice = Number(portfolioForm.buyPrice);

    if (!portfolioForm.coinId || quantity <= 0 || buyPrice <= 0) {
      setNotice("Please enter valid portfolio details.");
      return;
    }

    setPortfolio((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        coinId: portfolioForm.coinId,
        quantity,
        buyPrice,
        createdAt: new Date().toISOString(),
      },
    ]);
    setPortfolioForm({ coinId: "", quantity: "", buyPrice: "" });
    setShowPortfolioForm(false);
    setNotice("Portfolio position added.");
  }

  function addAlert(event) {
    event.preventDefault();
    const price = Number(alertForm.price);

    if (!alertForm.coinId || price <= 0) {
      setNotice("Please enter a valid alert.");
      return;
    }

    setAlerts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        coinId: alertForm.coinId,
        condition: alertForm.condition,
        price,
        triggered: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAlertForm({ coinId: "", condition: "above", price: "" });
    setShowAlertForm(false);
    setNotice("Price alert created.");
  }

  function resetLocalData() {
    setWatchlist([]);
    setPortfolio([]);
    setAlerts([]);
    setCompareCoins([]);
    setNotice("Local MetaTrack data has been cleared.");
  }

  function handleCurrencyChange(code) {
    ACTIVE_CURRENCY = code;
    setCurrency(code);
    setNotice(`Switched to ${currencyMeta(code).label}.`);
  }

  const btcDominance = globalMarket?.market_cap_percentage?.btc;
  const ethDominance = globalMarket?.market_cap_percentage?.eth;
  const heroCoin = coins.find((coin) => coin.id === heroCoinId) ?? coins[0];
  const activeCount = globalMarket?.active_cryptocurrencies;

  return (
    <div className={darkMode ? "app dark-theme" : "app light-theme"}>
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <nav className="mobile-tabbar">
        {NAV_ITEMS.slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
            aria-label={label}
          >
            <Icon className="mobile-tab-icon" />
            <small>{label}</small>
          </button>
        ))}
      </nav>

      <div className="shell-main">
        <Topbar
          search={search}
          setSearch={setSearch}
          onOpenPalette={() => setPaletteOpen(true)}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          refreshing={refreshing}
          onRefresh={() => refreshData(true)}
          alertCount={alerts.filter((a) => !a.triggered).length}
          onOpenAlerts={() => setPage("alerts")}
        />

        <main className="page-body">
          {/* ============================== HOME ============================== */}
          {page === "home" && (
            <div className="page page-home">
              <section className="hero">
                <div className="hero-copy">
                  <div className="hero-eyebrow">Real-time cryptocurrency insights</div>
                  <h1>
                    Track the market
                    <span> beyond the charts</span>
                  </h1>
                  <p>
                    A calm, editorial command center for cryptocurrency prices,
                    watchlists, portfolios and alerts — built on live market data.
                  </p>

                  <form
                    className="hero-search"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setPage("markets");
                    }}
                  >
                    <IconSearch className="hero-search-icon" />
                    <input
                      type="search"
                      placeholder="Search coin, symbol or rank…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <button type="submit">Search</button>
                  </form>

                  <div className="hero-quicklinks">
                    <button type="button" onClick={() => setPage("markets")}>
                      Explore markets
                    </button>
                    <button type="button" onClick={() => setPage("watchlist")}>
                      View watchlist
                    </button>
                  </div>
                </div>

                <div className="hero-panel">
                  <div className="hero-panel-glow" aria-hidden="true" />
                  <div className="hero-panel-top">
                    <span>Market status</span>
                    <span className="live-dot">● Live</span>
                  </div>
                  <div className="hero-panel-value">
                    {loading ? "Loading…" : `${cs()}${formatCompact(globalMarket?.total_market_cap?.usd)}`}
                  </div>
                  <p>total market capitalization</p>
                  <div className="hero-panel-stats">
                    <span>
                      24h volume
                      <b>{cs()}{formatCompact(globalMarket?.total_volume?.usd)}</b>
                    </span>
                    <span>
                      Tracked assets
                      <b>{coins.length || "—"}</b>
                    </span>
                  </div>
                </div>
              </section>

              <section className="stat-strip">
                <StatTile
                  label="Total market cap"
                  value={`${cs()}${formatCompact(globalMarket?.total_market_cap?.usd)}`}
                  sub={
                    globalMarket?.market_cap_change_percentage_24h_usd !== undefined
                      ? formatPercent(globalMarket.market_cap_change_percentage_24h_usd)
                      : "—"
                  }
                  tone={changeClass(globalMarket?.market_cap_change_percentage_24h_usd ?? 0)}
                />
                <StatTile label="24h volume" value={`${cs()}${formatCompact(globalMarket?.total_volume?.usd)}`} />
                <StatTile label="BTC dominance" value={btcDominance ? `${btcDominance.toFixed(2)}%` : "N/A"} />
                <StatTile label="ETH dominance" value={ethDominance ? `${ethDominance.toFixed(2)}%` : "N/A"} />
                <StatTile
                  label="Active cryptocurrencies"
                  value={activeCount ? formatCompact(activeCount) : "N/A"}
                />
              </section>

              <section className="home-grid">
                <div className="spotlight-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Spotlight</span>
                      <h2>{heroCoin ? `${heroCoin.name} overview` : "Market overview"}</h2>
                    </div>
                    <div className="range-toggle">
                      {CHART_RANGES.map((range) => (
                        <button
                          key={range}
                          type="button"
                          className={heroRange === range ? "active" : ""}
                          onClick={() => setHeroRange(range)}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  {heroCoin && (
                    <div className="spotlight-price-row">
                      <strong>{formatCurrency(heroCoin.current_price)}</strong>
                      <span className={changeClass(heroCoin.price_change_percentage_24h)}>
                        {formatPercent(heroCoin.price_change_percentage_24h)}
                      </span>
                    </div>
                  )}

                  <div className="spotlight-chart">
                    {heroChartLoading ? (
                      <div className="chart-loading">Loading chart…</div>
                    ) : (
                      <Chart
                        points={heroChart}
                        positive={Number(heroCoin?.price_change_percentage_24h ?? 0) >= 0}
                      />
                    )}
                  </div>

                  <div className="spotlight-picker">
                    {coins.slice(0, 6).map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        className={heroCoinId === coin.id ? "active" : ""}
                        onClick={() => setHeroCoinId(coin.id)}
                      >
                        <CoinLogo coin={coin} size={18} />
                        {coin.symbol.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="side-panels">
                  <div className="movers-panel">
                    <div className="panel-heading compact">
                      <span className="eyebrow">Market movers</span>
                      <div className="movers-tabs">
                        <button
                          type="button"
                          className={moversTab === "gainers" ? "active" : ""}
                          onClick={() => setMoversTab("gainers")}
                        >
                          Top gainers
                        </button>
                        <button
                          type="button"
                          className={moversTab === "losers" ? "active" : ""}
                          onClick={() => setMoversTab("losers")}
                        >
                          Top losers
                        </button>
                      </div>
                    </div>

                    <ol className="movers-list">
                      {(moversTab === "gainers" ? gainers : losers).map((coin, index) => (
                        <li key={coin.id}>
                          <button type="button" onClick={() => setSelectedCoin(coin)}>
                            <span className="movers-rank">{index + 1}</span>
                            <CoinLogo coin={coin} size={26} />
                            <span className="movers-name">{coin.symbol.toUpperCase()}</span>
                            <span className="movers-price">{formatCurrency(coin.current_price)}</span>
                            <span className={changeClass(coin.price_change_percentage_24h)}>
                              {formatPercent(coin.price_change_percentage_24h)}
                            </span>
                          </button>
                        </li>
                      ))}
                      {coins.length === 0 && <li className="movers-empty">No data yet.</li>}
                    </ol>
                  </div>

                  <div className="trending-panel">
                    <span className="eyebrow">Trending searches</span>
                    <ul>
                      {trending.map((item) => {
                        const trend = item.item;
                        return (
                          <li key={trend.id}>
                            <img src={trend.small} alt="" />
                            <span>{trend.name}</span>
                            <small>#{trend.market_cap_rank ?? "—"}</small>
                          </li>
                        );
                      })}
                      {trending.length === 0 && <li className="movers-empty">No trending data.</li>}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="section-block">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Markets</span>
                    <h2>Top cryptocurrencies</h2>
                  </div>
                </div>

                {loading ? (
                  <SkeletonRows count={6} />
                ) : (
                  <MarketsTable
                    coins={filteredCoins.slice(0, 8)}
                    watchlist={watchlist}
                    compareCoins={compareCoins}
                    onOpen={setSelectedCoin}
                    onWatch={toggleWatchlist}
                    onCompare={toggleCompare}
                  />
                )}

                <div className="section-block-footer">
                  <button type="button" className="link-button" onClick={() => setPage("markets")}>
                    View all markets →
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ============================== MARKETS ============================== */}
          {page === "markets" && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Markets</span>
                  <h1>Cryptocurrency markets</h1>
                  <p>Search, filter and sort every tracked asset.</p>
                </div>
                <div className="search-field">
                  <IconSearch className="hero-search-icon" />
                  <input
                    type="search"
                    placeholder="Search name, symbol or rank…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="controls-row">
                <div className="chip-row">
                  {FILTERS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={filter === value ? "chip active" : "chip"}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="chip-row muted">
                  <span>Sort</span>
                  {SORTS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={sortBy === value ? "chip active" : "chip"}
                      onClick={() => handleSort(value)}
                    >
                      {label}
                      {sortBy === value && (sortDirection === "asc" ? " ↑" : " ↓")}
                    </button>
                  ))}
                </div>
              </div>

              {loading && <SkeletonRows count={10} />}

              {!loading && error && (
                <EmptyState
                  icon="!"
                  title="Unable to load market data"
                  description={error}
                  action={
                    <button type="button" className="primary-small" onClick={() => refreshData(true)}>
                      Retry
                    </button>
                  }
                />
              )}

              <div id="markets-table-top" />

              {!loading && !error && (
                <>
                  <MarketsTable
                    coins={pagedCoins}
                    watchlist={watchlist}
                    compareCoins={compareCoins}
                    onOpen={setSelectedCoin}
                    onWatch={toggleWatchlist}
                    onCompare={toggleCompare}
                  />

                  <Pagination
                    page={currentMarketPage}
                    pageCount={marketPageCount}
                    totalItems={filteredCoins.length}
                    pageSize={PAGE_SIZE}
                    onChange={goToMarketPage}
                  />
                </>
              )}
            </div>
          )}

          {/* ============================== WATCHLIST ============================== */}
          {page === "watchlist" && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Personalized</span>
                  <h1>Your watchlist</h1>
                  <p>Saved locally in this browser — star any coin to add it here.</p>
                </div>
              </div>

              {watchlist.length === 0 ? (
                <EmptyState
                  icon={<IconStar className="empty-star" />}
                  title="Your watchlist is empty"
                  description="Star a coin from Markets or the command palette to track it here."
                  action={
                    <button type="button" className="primary-small" onClick={() => setPage("markets")}>
                      Browse markets
                    </button>
                  }
                />
              ) : (
                <MarketsTable
                  coins={coins.filter((coin) => watchlist.includes(coin.id))}
                  watchlist={watchlist}
                  compareCoins={compareCoins}
                  onOpen={setSelectedCoin}
                  onWatch={toggleWatchlist}
                  onCompare={toggleCompare}
                />
              )}
            </div>
          )}

          {/* ============================== COMPARE ============================== */}
          {page === "compare" && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Deep analysis</span>
                  <h1>Compare assets</h1>
                  <p>
                    A full side-by-side breakdown of up to three cryptocurrencies — price
                    action across five timeframes, valuation, supply and all-time
                    performance, all from live market data.
                  </p>
                </div>

                {compareData.length > 0 && compareData.length < 3 && (
                  <div className="compare-add">
                    <IconSearch className="hero-search-icon" />
                    <input
                      type="search"
                      placeholder="Add another coin…"
                      value={compareSearch}
                      onChange={(event) => setCompareSearch(event.target.value)}
                    />
                    {compareSearch.trim() && (
                      <div className="compare-add-results">
                        {coins
                          .filter((coin) => !compareCoins.includes(coin.id))
                          .filter((coin) => {
                            const term = compareSearch.trim().toLowerCase();
                            return (
                              coin.name.toLowerCase().includes(term) ||
                              coin.symbol.toLowerCase().includes(term)
                            );
                          })
                          .slice(0, 6)
                          .map((coin) => (
                            <button
                              key={coin.id}
                              type="button"
                              onClick={() => {
                                toggleCompare(coin.id);
                                setCompareSearch("");
                              }}
                            >
                              <CoinLogo coin={coin} size={20} />
                              <span>{coin.name}</span>
                              <small>{coin.symbol.toUpperCase()}</small>
                            </button>
                          ))}
                        {coins.filter((coin) => !compareCoins.includes(coin.id) &&
                          (coin.name.toLowerCase().includes(compareSearch.trim().toLowerCase()) ||
                            coin.symbol.toLowerCase().includes(compareSearch.trim().toLowerCase()))
                        ).length === 0 && <div className="compare-add-empty">No matches.</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {compareData.length === 0 ? (
                <EmptyState
                  icon={<IconCompare className="empty-star" />}
                  title="No coins selected"
                  description="Choose Compare on any market row to add it here — this page turns into a full analytical breakdown once you do."
                  action={
                    <button type="button" className="primary-small" onClick={() => setPage("markets")}>
                      Browse markets
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="compare-chip-row">
                    {compareData.map((coin) => (
                      <div className="compare-chip" key={coin.id}>
                        <CoinLogo coin={coin} size={22} />
                        <span>{coin.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleCompare(coin.id)}
                          aria-label={`Remove ${coin.name} from comparison`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="compare-charts-panel">
                    <div className="panel-heading compact">
                      <div>
                        <span className="eyebrow">Price action</span>
                        <h2>How each asset has moved</h2>
                      </div>
                      <div className="range-toggle">
                        {CHART_RANGES.map((range) => (
                          <button
                            key={range}
                            type="button"
                            className={compareRange === range ? "active" : ""}
                            onClick={() => setCompareRange(range)}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`compare-charts-grid cols-${compareData.length}`}>
                      {compareData.map((coin) => (
                        <div className="compare-chart-card" key={coin.id}>
                          <div className="compare-chart-card-head">
                            <CoinLogo coin={coin} size={26} />
                            <div>
                              <b>{coin.name}</b>
                              <small>{formatCurrency(coin.current_price)}</small>
                            </div>
                            <span className={changeClass(coin.price_change_percentage_24h)}>
                              {formatPercent(coin.price_change_percentage_24h)}
                            </span>
                          </div>
                          <div className="compare-mini-chart">
                            {compareChartsLoading ? (
                              <div className="chart-loading">Loading…</div>
                            ) : (
                              <Chart
                                points={compareCharts[coin.id] ?? []}
                                positive={Number(coin.price_change_percentage_24h ?? 0) >= 0}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="compare-metrics-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="eyebrow">Full breakdown</span>
                        <h2>Every metric, side by side</h2>
                      </div>
                      <span className="compare-hint">Gold highlight marks the leading value per row</span>
                    </div>

                    <div className="markets-table-wrapper">
                      <table className="compare-metrics-table">
                        <thead>
                          <tr>
                            <th>Metric</th>
                            {compareData.map((coin) => (
                              <th key={coin.id}>
                                <div className="compare-th-coin">
                                  <CoinLogo coin={coin} size={20} />
                                  {coin.symbol.toUpperCase()}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {buildCompareMetricRows(compareStats).map((row) => {
                            const rawValues = compareData.map((coin) => row.get(coin));
                            const validValues = rawValues.filter(
                              (v) => v !== null && v !== undefined && !Number.isNaN(v)
                            );
                            const best =
                              row.highlight && validValues.length > 1 ? Math.max(...validValues) : null;

                            return (
                              <tr key={row.label}>
                                <td className="metric-label">{row.label}</td>
                                {compareData.map((coin, index) => (
                                  <td
                                    key={coin.id}
                                    className={best !== null && rawValues[index] === best ? "leading" : ""}
                                  >
                                    {row.fmt(coin)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============================== PORTFOLIO ============================== */}
          {page === "portfolio" && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Portfolio</span>
                  <h1>Portfolio tracker</h1>
                  <p>Track holdings locally — no wallet or exchange connection required.</p>
                </div>
                <button type="button" className="primary-small" onClick={() => setShowPortfolioForm(true)}>
                  + Add position
                </button>
              </div>

              <section className="stat-strip">
                <StatTile label="Total invested" value={`${cs()}${formatCompact(totalInvested)}`} />
                <StatTile label="Current value" value={`${cs()}${formatCompact(currentPortfolioValue)}`} />
                <StatTile
                  label="Profit / loss"
                  value={`${cs()}${formatCompact(portfolioProfit)}`}
                  sub={totalInvested ? formatPercent((portfolioProfit / totalInvested) * 100) : "—"}
                  tone={changeClass(portfolioProfit)}
                />
              </section>

              {portfolio.length === 0 ? (
                <EmptyState
                  icon={<IconPortfolio className="empty-star" />}
                  title="No portfolio positions"
                  description="Add a cryptocurrency, quantity and purchase price to start tracking."
                />
              ) : (
                <div className="position-list">
                  {portfolio.map((item) => {
                    const coin = coins.find((c) => c.id === item.coinId);
                    const invested = Number(item.quantity) * Number(item.buyPrice);
                    const current = coin ? Number(item.quantity) * Number(coin.current_price) : 0;
                    const pnl = current - invested;

                    return (
                      <div className="position-row" key={item.id}>
                        {coin && <CoinLogo coin={coin} size={38} />}
                        <span>
                          <b>{coin?.name ?? item.coinId}</b>
                          <small>
                            {formatNumber(item.quantity)} {coin?.symbol?.toUpperCase()} · Buy{" "}
                            {formatCurrency(item.buyPrice)}
                          </small>
                        </span>
                        <strong>{formatCurrency(current)}</strong>
                        <em className={changeClass(pnl)}>
                          {formatPercent(invested ? (pnl / invested) * 100 : 0)}
                        </em>
                        <button
                          type="button"
                          onClick={() =>
                            setPortfolio((items) => items.filter((entry) => entry.id !== item.id))
                          }
                          aria-label="Remove portfolio position"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================== ALERTS ============================== */}
          {page === "alerts" && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Alerts</span>
                  <h1>Price alerts</h1>
                  <p>Checked automatically whenever fresh market data arrives.</p>
                </div>
                <button type="button" className="primary-small" onClick={() => setShowAlertForm(true)}>
                  + Create alert
                </button>
              </div>

              {alerts.length === 0 ? (
                <EmptyState
                  icon={<IconBell className="empty-star" />}
                  title="No active alerts"
                  description="Create an alert such as Bitcoin above $100,000."
                />
              ) : (
                <div className="alert-list">
                  {alerts.map((alert) => {
                    const coin = coins.find((c) => c.id === alert.coinId);
                    return (
                      <div className={`alert-row ${alert.triggered ? "triggered" : ""}`} key={alert.id}>
                        <span className="alert-icon">
                          <IconBell className="bell-icon" />
                        </span>
                        <div>
                          <b>
                            {coin?.name ?? alert.coinId} {alert.condition === "above" ? "≥" : "≤"}{" "}
                            {formatCurrency(alert.price)}
                          </b>
                          <small>{alert.triggered ? "Triggered" : "Active"}</small>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAlerts((items) => items.filter((item) => item.id !== alert.id))}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================== SETTINGS ============================== */}
          {page === "settings" && (
            <div className="page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">Settings</span>
                  <h1>Preferences</h1>
                  <p>Appearance, region, data refresh and about MetaTrack.</p>
                </div>
              </div>

              <div className="settings-layout">
                <section className="settings-section">
                  <span className="eyebrow">Appearance</span>
                  <div className="settings-panel">
                    <div className="settings-row">
                      <div className="settings-row-text">
                        <b>Theme</b>
                        <p>Choose between the charcoal and ivory looks.</p>
                      </div>
                      <div className="segmented" role="group" aria-label="Theme">
                        <button
                          type="button"
                          className={darkMode ? "active" : ""}
                          onClick={() => setDarkMode(true)}
                        >
                          Dark
                        </button>
                        <button
                          type="button"
                          className={!darkMode ? "active" : ""}
                          onClick={() => setDarkMode(false)}
                        >
                          Light
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="settings-section">
                  <span className="eyebrow">Region &amp; data</span>
                  <div className="settings-panel">
                    <div className="settings-row">
                      <div className="settings-row-text">
                        <b>Currency</b>
                        <p>Prices, market cap and volume are re-fetched live in this currency.</p>
                      </div>
                      <select
                        className="settings-select"
                        value={currency}
                        onChange={(event) => handleCurrencyChange(event.target.value)}
                      >
                        {CURRENCIES.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label} ({option.symbol})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="settings-row">
                      <div className="settings-row-text">
                        <b>Auto-refresh</b>
                        <p>How often market data and price alerts are checked.</p>
                      </div>
                      <select
                        className="settings-select"
                        value={refreshIntervalMs}
                        onChange={(event) => setRefreshIntervalMs(Number(event.target.value))}
                      >
                        <option value={0}>Off (manual only)</option>
                        <option value={30_000}>Every 30 seconds</option>
                        <option value={60_000}>Every 1 minute</option>
                        <option value={120_000}>Every 2 minutes</option>
                        <option value={300_000}>Every 5 minutes</option>
                      </select>
                    </div>

                    <div className="settings-row">
                      <div className="settings-row-text">
                        <b>Default chart range</b>
                        <p>The range charts open with on Home and in coin details.</p>
                      </div>
                      <select
                        className="settings-select"
                        value={defaultChartRange}
                        onChange={(event) => setDefaultChartRange(event.target.value)}
                      >
                        {CHART_RANGES.map((range) => (
                          <option key={range} value={range}>
                            {range}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="settings-section">
                  <span className="eyebrow">Your data</span>
                  <div className="settings-panel">
                    <div className="settings-row">
                      <div className="settings-row-text">
                        <b>Clear local data</b>
                        <p>Removes your watchlist, portfolio and alerts. They are stored only in this browser.</p>
                      </div>
                      <button type="button" className="secondary-button danger" onClick={resetLocalData}>
                        Clear data
                      </button>
                    </div>
                  </div>
                </section>

                <section className="settings-section">
                  <span className="eyebrow">About</span>
                  <div className="settings-panel">
                    <div className="settings-row">
                      <div className="settings-about">
                        <img src={profileImage} alt="Harsh profile" />
                        <div className="settings-row-text">
                          <b>Harsh</b>
                          <p>Creator and developer of MetaTrack.</p>
                        </div>
                      </div>
                      <a
                        className="secondary-button settings-link"
                        href={CREATOR_INSTAGRAM}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Instagram →
                      </a>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================== COIN DETAIL MODAL ============================== */}
      {selectedCoin && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedCoin(null)}
        >
          <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="coin-detail-title">
            <button className="modal-close" type="button" onClick={() => setSelectedCoin(null)} aria-label="Close details">
              ×
            </button>

            <div className="detail-header">
              <div className="tracking-coin">
                <CoinLogo coin={selectedCoin} size={56} />
                <div>
                  <div className="eyebrow">#{selectedCoin.market_cap_rank ?? "—"} market cap</div>
                  <h2 id="coin-detail-title">{selectedCoin.name}</h2>
                  <span>{selectedCoin.symbol.toUpperCase()}</span>
                </div>
              </div>
              <div className="detail-price">
                <strong>{formatCurrency(selectedCoin.current_price)}</strong>
                <span className={changeClass(selectedCoin.price_change_percentage_24h)}>
                  {formatPercent(selectedCoin.price_change_percentage_24h)}
                </span>
              </div>
            </div>

            <div className="detail-stats">
              <StatTile label="Market cap" value={`${cs()}${formatCompact(selectedCoin.market_cap)}`} />
              <StatTile label="24h volume" value={`${cs()}${formatCompact(selectedCoin.total_volume)}`} />
              <StatTile label="Circulating supply" value={formatCompact(selectedCoin.circulating_supply)} />
              <StatTile label="All-time high" value={formatCurrency(selectedCoin.ath)} />
            </div>

            <div className="chart-toolbar">
              <div>
                <b>Price history</b>
                <span>{chartRange}</span>
              </div>
              <div>
                {CHART_RANGES.map((range) => (
                  <button
                    type="button"
                    key={range}
                    className={chartRange === range ? "active" : ""}
                    onClick={() => setChartRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="detail-chart">
              {chartLoading ? (
                <div className="chart-loading">Loading chart…</div>
              ) : (
                <Chart
                  points={chartData}
                  positive={Number(selectedCoin.price_change_percentage_24h ?? 0) >= 0}
                />
              )}
            </div>

            <div className="detail-footer">
              <button
                type="button"
                className={`secondary-button ${watchlist.includes(selectedCoin.id) ? "active" : ""}`}
                onClick={() => toggleWatchlist(selectedCoin.id)}
              >
                {watchlist.includes(selectedCoin.id) ? "★ In watchlist" : "☆ Add to watchlist"}
              </button>
              <button type="button" className="secondary-button" onClick={() => toggleCompare(selectedCoin.id)}>
                {compareCoins.includes(selectedCoin.id) ? "Added to compare" : "Add to compare"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== PORTFOLIO FORM ============================== */}
      {showPortfolioForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setShowPortfolioForm(false)}
        >
          <form className="form-modal" onSubmit={addPortfolioPosition}>
            <button className="modal-close" type="button" onClick={() => setShowPortfolioForm(false)}>
              ×
            </button>
            <div className="eyebrow">Portfolio</div>
            <h2>Add position</h2>

            <label>
              Cryptocurrency
              <select
                value={portfolioForm.coinId}
                onChange={(event) => setPortfolioForm((c) => ({ ...c, coinId: event.target.value }))}
              >
                <option value="">Select asset</option>
                {coins.map((coin) => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name} ({coin.symbol.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="0"
                step="any"
                value={portfolioForm.quantity}
                onChange={(event) => setPortfolioForm((c) => ({ ...c, quantity: event.target.value }))}
                placeholder="0.25"
              />
            </label>

            <label>
              Buy price (USD)
              <input
                type="number"
                min="0"
                step="any"
                value={portfolioForm.buyPrice}
                onChange={(event) => setPortfolioForm((c) => ({ ...c, buyPrice: event.target.value }))}
                placeholder="50000"
              />
            </label>

            <button className="primary-button" type="submit">
              Add position
            </button>
          </form>
        </div>
      )}

      {/* ============================== ALERT FORM ============================== */}
      {showAlertForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setShowAlertForm(false)}
        >
          <form className="form-modal" onSubmit={addAlert}>
            <button className="modal-close" type="button" onClick={() => setShowAlertForm(false)}>
              ×
            </button>
            <div className="eyebrow">Price alert</div>
            <h2>Create alert</h2>

            <label>
              Cryptocurrency
              <select
                value={alertForm.coinId}
                onChange={(event) => setAlertForm((c) => ({ ...c, coinId: event.target.value }))}
              >
                <option value="">Select asset</option>
                {coins.map((coin) => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name} ({coin.symbol.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Condition
              <select
                value={alertForm.condition}
                onChange={(event) => setAlertForm((c) => ({ ...c, condition: event.target.value }))}
              >
                <option value="above">Price reaches / exceeds</option>
                <option value="below">Price drops below</option>
              </select>
            </label>

            <label>
              Target price (USD)
              <input
                type="number"
                min="0"
                step="any"
                value={alertForm.price}
                onChange={(event) => setAlertForm((c) => ({ ...c, price: event.target.value }))}
                placeholder="100000"
              />
            </label>

            <button className="primary-button" type="submit">
              Create alert
            </button>
          </form>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        coins={coins}
        setPage={setPage}
        onOpenCoin={setSelectedCoin}
        search={search}
        setSearch={setSearch}
      />

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

export default App;