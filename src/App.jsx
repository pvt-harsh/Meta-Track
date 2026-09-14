import {
  useCallback,
  useEffect,
  useMemo,
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

const CREATOR_INSTAGRAM =
  "https://www.instagram.com/_pvt.hash/";

const COIN_LIMIT = 103;

const CHART_RANGES = [
  "1H",
  "24H",
  "7D",
  "30D",
  "1Y",
  "MAX",
];

const FILTERS = [
  ["all", "All"],
  ["favorites", "Favorites"],
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
  ["marketCap", "Market Cap"],
  ["volume", "Volume"],
  ["supply", "Supply"],
];

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

function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  const number = Number(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits:
      Math.abs(number) < 1 ? 8 : 2,
  }).format(number);
}

function formatCompact(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatPercent(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "N/A";
  }

  const number = Number(value);

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function changeClass(value) {
  return Number(value) >= 0
    ? "positive"
    : "negative";
}

function CoinLogo({ coin, size = 42 }) {
  const [failed, setFailed] = useState(false);

  if (failed || !coin?.image) {
    return (
      <span
        className="coin-fallback"
        style={{
          width: size,
          height: size,
        }}
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

function SkeletonGrid() {
  return (
    <div className="coin-grid">
      {Array.from({ length: 12 }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </article>
  );
}

function Chart({ points, positive }) {
  const values = points
    .map((item) => Number(item[1]))
    .filter(Number.isFinite);

  if (values.length < 2) {
    return (
      <div className="chart-empty">
        Historical chart data is unavailable.
      </div>
    );
  }

  const width = 1000;
  const height = 300;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coordinates = values
    .map((value, index) => {
      const x =
        (index / (values.length - 1)) * width;

      const y =
        height -
        25 -
        ((value - min) / range) *
          (height - 55);

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Historical cryptocurrency price chart"
    >
      <defs>
        <linearGradient
          id="chartGradient"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopOpacity="0.25"
          />
          <stop
            offset="100%"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      <line
        className="chart-grid"
        x1="0"
        y1="75"
        x2={width}
        y2="75"
      />

      <line
        className="chart-grid"
        x1="0"
        y1="150"
        x2={width}
        y2="150"
      />

      <line
        className="chart-grid"
        x1="0"
        y1="225"
        x2={width}
        y2="225"
      />

      <polygon
        className="chart-fill"
        points={`0,${height} ${coordinates} ${width},${height}`}
      />

      <polyline
        className={`chart-path ${
          positive ? "up" : "down"
        }`}
        points={coordinates}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CoinCard({
  coin,
  watched,
  compared,
  onOpen,
  onWatch,
  onCompare,
}) {
  const change =
    coin.price_change_percentage_24h ?? 0;

  return (
    <article className="coin-card">
      <div className="coin-card-top">
        <button
          className="coin-main-info"
          type="button"
          onClick={() => onOpen(coin)}
          aria-label={`Open ${coin.name} details`}
        >
          <CoinLogo coin={coin} />

          <span>
            <b>{coin.name}</b>
            <small>
              {coin.symbol.toUpperCase()} · #
              {coin.market_cap_rank ?? "—"}
            </small>
          </span>
        </button>

        <button
          className={`icon-button ${
            watched ? "active" : ""
          }`}
          type="button"
          onClick={() => onWatch(coin.id)}
          aria-label={
            watched
              ? `Remove ${coin.name} from watchlist`
              : `Add ${coin.name} to watchlist`
          }
        >
          {watched ? "★" : "☆"}
        </button>
      </div>

      <div className="price-row">
        <strong>
          {formatCurrency(coin.current_price)}
        </strong>

        <span className={changeClass(change)}>
          {formatPercent(change)}
        </span>
      </div>

      <div className="coin-stats">
        <div>
          <span>Market cap</span>
          <b>${formatCompact(coin.market_cap)}</b>
        </div>

        <div>
          <span>24h volume</span>
          <b>
            ${formatCompact(coin.total_volume)}
          </b>
        </div>
      </div>

      <div className="coin-actions">
        <button
          type="button"
          onClick={() => onOpen(coin)}
        >
          View details
        </button>

        <button
          type="button"
          className={
            compared ? "selected-action" : ""
          }
          onClick={() => onCompare(coin.id)}
        >
          {compared ? "Compared" : "Compare"}
        </button>
      </div>
    </article>
  );
}

function App() {
  const [coins, setCoins] = useState([]);
  const [globalMarket, setGlobalMarket] =
    useState(null);
  const [trending, setTrending] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [sortBy, setSortBy] = useState("rank");
  const [sortDirection, setSortDirection] =
    useState("asc");

  const [darkMode, setDarkMode] = useState(
    () =>
      readStorage(
        "metatrack-theme",
        true
      )
  );

  const [watchlist, setWatchlist] =
    useState(() =>
      readStorage(
        "metatrack-watchlist",
        []
      )
    );

  const [compareCoins, setCompareCoins] =
    useState([]);

  const [selectedCoin, setSelectedCoin] =
    useState(null);

  const [chartRange, setChartRange] =
    useState("7D");

  const [chartData, setChartData] =
    useState([]);

  const [chartLoading, setChartLoading] =
    useState(false);

  const [portfolio, setPortfolio] =
    useState(() =>
      readStorage(
        "metatrack-portfolio",
        []
      )
    );

  const [alerts, setAlerts] =
    useState(() =>
      readStorage(
        "metatrack-alerts",
        []
      )
    );

  const [portfolioForm, setPortfolioForm] =
    useState({
      coinId: "",
      quantity: "",
      buyPrice: "",
    });

  const [alertForm, setAlertForm] =
    useState({
      coinId: "",
      condition: "above",
      price: "",
    });

  const [showPortfolioForm, setShowPortfolioForm] =
    useState(false);

  const [showAlertForm, setShowAlertForm] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const refreshData = useCallback(
    async (manual = false) => {
      try {
        if (manual) {
          setRefreshing(true);
          clearApiCache();
        }

        setError("");

        const [
          marketData,
          globalData,
          trendingData,
        ] = await Promise.all([
          getMarkets({
            force: manual,
          }),
          getGlobalMarket({
            force: manual,
          }),
          getTrending({
            force: manual,
          }),
        ]);

        if (
          !Array.isArray(marketData) ||
          marketData.length === 0
        ) {
          throw new Error(
            "No cryptocurrency market data was returned."
          );
        }

        const limitedCoins = marketData
          .filter(
            (coin) =>
              coin &&
              coin.id &&
              coin.name &&
              coin.symbol
          )
          .sort(
            (a, b) =>
              (a.market_cap_rank ?? 999999) -
              (b.market_cap_rank ?? 999999)
          )
          .slice(0, COIN_LIMIT);

        setCoins(limitedCoins);

        setGlobalMarket(
          globalData?.data ?? null
        );

        setTrending(
          (trendingData?.coins ?? [])
            .slice(0, 8)
        );

        setSelectedCoin((current) => {
          if (!current) return null;

          return (
            limitedCoins.find(
              (coin) =>
                coin.id === current.id
            ) ?? current
          );
        });
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load cryptocurrency data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    refreshData();

    const timer = setInterval(
      () => refreshData(),
      60_000
    );

    return () => clearInterval(timer);
  }, [refreshData]);

  useEffect(() => {
    writeStorage(
      "metatrack-theme",
      darkMode
    );
  }, [darkMode]);

  useEffect(() => {
    writeStorage(
      "metatrack-watchlist",
      watchlist
    );
  }, [watchlist]);

  useEffect(() => {
    writeStorage(
      "metatrack-portfolio",
      portfolio
    );
  }, [portfolio]);

  useEffect(() => {
    writeStorage(
      "metatrack-alerts",
      alerts
    );
  }, [alerts]);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(
      () => setNotice(""),
      3000
    );

    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!selectedCoin) return;

    let cancelled = false;

    async function loadChart() {
      try {
        setChartLoading(true);
        setChartData([]);

        const data =
          await getCoinChart(
            selectedCoin.id,
            chartRange
          );

        if (!cancelled) {
          setChartData(
            Array.isArray(data?.prices)
              ? data.prices
              : []
          );
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setChartData([]);
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    }

    loadChart();

    return () => {
      cancelled = true;
    };
  }, [selectedCoin, chartRange]);

  useEffect(() => {
    if (!coins.length || !alerts.length) {
      return;
    }

    let changed = false;

    const nextAlerts = alerts.map(
      (alert) => {
        if (alert.triggered) {
          return alert;
        }

        const coin = coins.find(
          (item) =>
            item.id === alert.coinId
        );

        if (!coin) {
          return alert;
        }

        const price =
          Number(coin.current_price);

        const target =
          Number(alert.price);

        const triggered =
          alert.condition === "above"
            ? price >= target
            : price <= target;

        if (triggered) {
          changed = true;

          setNotice(
            `${coin.name} price alert triggered.`
          );

          return {
            ...alert,
            triggered: true,
            triggeredAt:
              new Date().toISOString(),
          };
        }

        return alert;
      }
    );

    if (changed) {
      setAlerts(nextAlerts);
    }
  }, [coins, alerts]);

  const toggleWatchlist = useCallback(
    (coinId) => {
      setWatchlist((current) =>
        current.includes(coinId)
          ? current.filter(
              (id) => id !== coinId
            )
          : [...current, coinId]
      );
    },
    []
  );

  const toggleCompare = useCallback(
    (coinId) => {
      setCompareCoins((current) => {
        if (current.includes(coinId)) {
          return current.filter(
            (id) => id !== coinId
          );
        }

        if (current.length >= 3) {
          setNotice(
            "You can compare up to 3 cryptocurrencies."
          );

          return current;
        }

        return [...current, coinId];
      });
    },
    []
  );

  const compareData = useMemo(
    () =>
      compareCoins
        .map((id) =>
          coins.find(
            (coin) => coin.id === id
          )
        )
        .filter(Boolean),
    [coins, compareCoins]
  );

  const filteredCoins = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    let result = coins;

    if (term) {
      result = result.filter((coin) => {
        const name =
          coin.name?.toLowerCase() ?? "";

        const symbol =
          coin.symbol?.toLowerCase() ?? "";

        const rank =
          String(
            coin.market_cap_rank ?? ""
          );

        return (
          name.includes(term) ||
          symbol.includes(term) ||
          rank === term
        );
      });
    }

    switch (filter) {
      case "favorites":
        result = result.filter((coin) =>
          watchlist.includes(coin.id)
        );
        break;

      case "top10":
        result = result.filter(
          (coin) =>
            (coin.market_cap_rank ?? 999) <=
            10
        );
        break;

      case "top50":
        result = result.filter(
          (coin) =>
            (coin.market_cap_rank ?? 999) <=
            50
        );
        break;

      case "top100":
        result = result.filter(
          (coin) =>
            (coin.market_cap_rank ?? 999) <=
            100
        );
        break;

      case "gainers":
        result = result.filter(
          (coin) =>
            Number(
              coin.price_change_percentage_24h
            ) > 0
        );
        break;

      case "losers":
        result = result.filter(
          (coin) =>
            Number(
              coin.price_change_percentage_24h
            ) < 0
        );
        break;

      default:
        break;
    }

    return [...result].sort(
      (a, b) => {
        let left;
        let right;

        switch (sortBy) {
          case "name":
            left = a.name?.toLowerCase();
            right = b.name?.toLowerCase();
            break;

          case "price":
            left = Number(
              a.current_price ?? 0
            );
            right = Number(
              b.current_price ?? 0
            );
            break;

          case "change":
            left = Number(
              a.price_change_percentage_24h ??
                0
            );
            right = Number(
              b.price_change_percentage_24h ??
                0
            );
            break;

          case "marketCap":
            left = Number(
              a.market_cap ?? 0
            );
            right = Number(
              b.market_cap ?? 0
            );
            break;

          case "volume":
            left = Number(
              a.total_volume ?? 0
            );
            right = Number(
              b.total_volume ?? 0
            );
            break;

          case "supply":
            left = Number(
              a.circulating_supply ?? 0
            );
            right = Number(
              b.circulating_supply ?? 0
            );
            break;

          default:
            left =
              a.market_cap_rank ??
              999999;

            right =
              b.market_cap_rank ??
              999999;
        }

        if (
          typeof left === "string" &&
          typeof right === "string"
        ) {
          return (
            sortDirection === "asc"
              ? left.localeCompare(right)
              : right.localeCompare(left)
          );
        }

        return (
          sortDirection === "asc"
            ? left - right
            : right - left
        );
      }
    );
  }, [
    coins,
    filter,
    search,
    sortBy,
    sortDirection,
    watchlist,
  ]);

  const topGainer = useMemo(
    () =>
      [...coins].sort(
        (a, b) =>
          Number(
            b.price_change_percentage_24h ??
              0
          ) -
          Number(
            a.price_change_percentage_24h ??
              0
          )
      )[0],
    [coins]
  );

  const topLoser = useMemo(
    () =>
      [...coins].sort(
        (a, b) =>
          Number(
            a.price_change_percentage_24h ??
              0
          ) -
          Number(
            b.price_change_percentage_24h ??
              0
          )
      )[0],
    [coins]
  );

  const totalInvested = useMemo(
    () =>
      portfolio.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity) *
            Number(item.buyPrice),
        0
      ),
    [portfolio]
  );

  const currentPortfolioValue =
    useMemo(
      () =>
        portfolio.reduce(
          (sum, item) => {
            const coin =
              coins.find(
                (c) =>
                  c.id === item.coinId
              );

            return (
              sum +
              (coin
                ? Number(item.quantity) *
                  Number(
                    coin.current_price
                  )
                : 0)
            );
          },
          0
        ),
      [portfolio, coins]
    );

  const portfolioProfit =
    currentPortfolioValue -
    totalInvested;

  function handleSort(value) {
    if (sortBy === value) {
      setSortDirection((current) =>
        current === "asc"
          ? "desc"
          : "asc"
      );
    } else {
      setSortBy(value);
      setSortDirection(
        value === "name"
          ? "asc"
          : "desc"
      );
    }
  }

  function addPortfolioPosition(
    event
  ) {
    event.preventDefault();

    const quantity =
      Number(portfolioForm.quantity);

    const buyPrice =
      Number(portfolioForm.buyPrice);

    if (
      !portfolioForm.coinId ||
      quantity <= 0 ||
      buyPrice <= 0
    ) {
      setNotice(
        "Please enter valid portfolio details."
      );
      return;
    }

    setPortfolio((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        coinId: portfolioForm.coinId,
        quantity,
        buyPrice,
        createdAt:
          new Date().toISOString(),
      },
    ]);

    setPortfolioForm({
      coinId: "",
      quantity: "",
      buyPrice: "",
    });

    setShowPortfolioForm(false);
    setNotice(
      "Portfolio position added."
    );
  }

  function addAlert(event) {
    event.preventDefault();

    const price =
      Number(alertForm.price);

    if (
      !alertForm.coinId ||
      price <= 0
    ) {
      setNotice(
        "Please enter a valid alert."
      );
      return;
    }

    setAlerts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        coinId: alertForm.coinId,
        condition:
          alertForm.condition,
        price,
        triggered: false,
        createdAt:
          new Date().toISOString(),
      },
    ]);

    setAlertForm({
      coinId: "",
      condition: "above",
      price: "",
    });

    setShowAlertForm(false);

    setNotice(
      "Price alert created."
    );
  }

  const btcDominance =
    globalMarket?.market_cap_percentage
      ?.btc;

  const ethDominance =
    globalMarket?.market_cap_percentage
      ?.eth;

  return (
    <div
      className={
        darkMode
          ? "app dark-theme"
          : "app light-theme"
      }
    >
      {/* NAVBAR */}

      <header className="navbar">
        <a
  className="logo"
  href="#home"
>
  <img
    src="/favicon.png"
    alt="Meta Track"
    className="logo-image"
  />

  <span>Meta Track</span>
</a>

        <nav>
          <a href="#dashboard">
            Dashboard
          </a>

          <a href="#markets">
            Markets
          </a>

          <a href="#watchlist">
            Watchlist
          </a>

          <a href="#portfolio">
            Portfolio
          </a>

          <a href="#alerts">
            Alerts
          </a>

          <a href="#compare">
            Compare
          </a>
        </nav>

        <button
          className="theme-button"
          type="button"
          onClick={() =>
            setDarkMode(
              (value) => !value
            )
          }
          aria-label="Toggle theme"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </header>

      <main>
        {/* HERO */}

        <section
          className="hero"
          id="home"
        >
          <div className="hero-content">
            <div className="status-badge">
              <span className="status-dot" />
              LIVE CRYPTO DATA
            </div>

            <h1>
              Track the Crypto Market
              <span>
                Smarter.
              </span>
            </h1>

            <p className="hero-description">
              Meta Track gives you a fast,
              modern command center for
              cryptocurrency markets,
              watchlists, portfolios,
              alerts and price analysis.
            </p>

            <div className="hero-actions">
              <a
                href="#dashboard"
                className="primary-button"
              >
                Explore Dashboard
              </a>

              <a
                href="#markets"
                className="secondary-button"
              >
                View Markets
              </a>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-top">
              <span>
                Market Status
              </span>

              <span className="live-indicator">
                ● Live
              </span>
            </div>

            <div className="hero-price">
  {loading
    ? "Loading..."
    : "100+"}
</div>

            <p>
              cryptocurrencies tracked
              by market capitalization
            </p>

            {globalMarket && (
              <div className="hero-mini-stats">
                <span>
                  Market cap
                  <b>
                    $
                    {formatCompact(
                      globalMarket.total_market_cap
                        ?.usd
                    )}
                  </b>
                </span>

                <span>
                  24h volume
                  <b>
                    $
                    {formatCompact(
                      globalMarket.total_volume
                        ?.usd
                    )}
                  </b>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* DASHBOARD */}

        <section
          className="section"
          id="dashboard"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                DASHBOARD
              </div>

              <h2>
                Market Overview
              </h2>

              <p>
                Live market intelligence
                across the top
                cryptocurrencies.
              </p>
            </div>

            <button
              className="refresh-button"
              type="button"
              onClick={() =>
                refreshData(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>
          </div>

          <div className="stats-grid">
            <StatCard
              label="Total market cap"
              value={`$${formatCompact(
                globalMarket
                  ?.total_market_cap?.usd
              )}`}
              sub={
                globalMarket
                  ?.market_cap_change_percentage_24h_usd !==
                undefined
                  ? formatPercent(
                      globalMarket.market_cap_change_percentage_24h_usd
                    )
                  : undefined
              }
            />

            <StatCard
              label="24h volume"
              value={`$${formatCompact(
                globalMarket
                  ?.total_volume?.usd
              )}`}
            />

            <StatCard
              label="BTC dominance"
              value={
                btcDominance
                  ? `${btcDominance.toFixed(
                      2
                    )}%`
                  : "N/A"
              }
            />

            <StatCard
              label="ETH dominance"
              value={
                ethDominance
                  ? `${ethDominance.toFixed(
                      2
                    )}%`
                  : "N/A"
              }
            />

            <StatCard
              label="Tracked assets"
              value={`${coins.length}`}
            />

            <StatCard
              label="Top gainer"
              value={
                topGainer
                  ? topGainer.symbol.toUpperCase()
                  : "N/A"
              }
              sub={
                topGainer
                  ? formatPercent(
                      topGainer.price_change_percentage_24h
                    )
                  : undefined
              }
            />
          </div>
        </section>

        {/* MARKETS */}

        <section
          className="section"
          id="markets"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                MARKETS
              </div>

              <h2>
                Cryptocurrency Markets
              </h2>

              <p>
                Search, filter and sort
                {` ${coins.length || COIN_LIMIT}`}
                cryptocurrencies.
              </p>
            </div>

            <div className="search-wrapper">
              <span>⌕</span>

              <input
                type="search"
                placeholder="Search name, symbol or rank..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                aria-label="Search cryptocurrencies"
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="controls-row">
            <div className="filter-list">
              {FILTERS.map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      filter === value
                        ? "control-active"
                        : ""
                    }
                    onClick={() =>
                      setFilter(value)
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="sort-controls">
              <span>
                Sort:
              </span>

              {SORTS.map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      sortBy === value
                        ? "sort-active"
                        : ""
                    }
                    onClick={() =>
                      handleSort(value)
                    }
                  >
                    {label}
                    {sortBy === value &&
                      (sortDirection ===
                      "asc"
                        ? " ↑"
                        : " ↓")}
                  </button>
                )
              )}
            </div>
          </div>

          {loading && (
            <SkeletonGrid />
          )}

          {!loading && error && (
            <div className="message-box error-box">
              <strong>
                Unable to load market data.
              </strong>

              <span>
                {error}
              </span>

              <button
                type="button"
                className="primary-small"
                onClick={() =>
                  refreshData(true)
                }
              >
                Retry
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            filteredCoins.length > 0 && (
              <div className="coin-grid">
                {filteredCoins.map(
                  (coin) => (
                    <CoinCard
                      key={coin.id}
                      coin={coin}
                      watched={watchlist.includes(
                        coin.id
                      )}
                      compared={compareCoins.includes(
                        coin.id
                      )}
                      onOpen={
                        setSelectedCoin
                      }
                      onWatch={
                        toggleWatchlist
                      }
                      onCompare={
                        toggleCompare
                      }
                    />
                  )
                )}
              </div>
            )}

          {!loading &&
            !error &&
            filteredCoins.length ===
              0 && (
              <div className="message-box">
                <div className="empty-icon">
                  ⌕
                </div>

                <strong>
                  No cryptocurrency found
                </strong>

                <span>
                  Try another name,
                  symbol or rank.
                </span>
              </div>
            )}
        </section>

        {/* TOP MOVERS */}

        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                MARKET MOVERS
              </div>

              <h2>
                Top Gainers & Losers
              </h2>
            </div>
          </div>

          <div className="movers-grid">
            <div className="mover-card">
              <span className="mover-label positive">
                TOP GAINER
              </span>

              {topGainer ? (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCoin(
                      topGainer
                    )
                  }
                  className="mover-content"
                >
                  <CoinLogo
                    coin={topGainer}
                    size={50}
                  />

                  <span>
                    <b>
                      {topGainer.name}
                    </b>

                    <small>
                      {topGainer.symbol.toUpperCase()}
                    </small>
                  </span>

                  <strong className="positive">
                    {formatPercent(
                      topGainer.price_change_percentage_24h
                    )}
                  </strong>
                </button>
              ) : (
                "N/A"
              )}
            </div>

            <div className="mover-card">
              <span className="mover-label negative">
                TOP LOSER
              </span>

              {topLoser ? (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCoin(
                      topLoser
                    )
                  }
                  className="mover-content"
                >
                  <CoinLogo
                    coin={topLoser}
                    size={50}
                  />

                  <span>
                    <b>
                      {topLoser.name}
                    </b>

                    <small>
                      {topLoser.symbol.toUpperCase()}
                    </small>
                  </span>

                  <strong className="negative">
                    {formatPercent(
                      topLoser.price_change_percentage_24h
                    )}
                  </strong>
                </button>
              ) : (
                "N/A"
              )}
            </div>
          </div>
        </section>

        {/* WATCHLIST */}

        <section
          className="section"
          id="watchlist"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                PERSONALIZED
              </div>

              <h2>
                Your Watchlist
              </h2>

              <p>
                Your favorites are stored
                locally in this browser.
              </p>
            </div>
          </div>

          {watchlist.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">
                ☆
              </div>

              <h3>
                Your watchlist is empty
              </h3>

              <p>
                Click the star on any
                cryptocurrency to add it
                here.
              </p>
            </div>
          ) : (
            <div className="watchlist-grid">
              {watchlist
                .map((id) =>
                  coins.find(
                    (coin) =>
                      coin.id === id
                  )
                )
                .filter(Boolean)
                .map((coin) => (
                  <button
                    type="button"
                    className="watch-card"
                    key={coin.id}
                    onClick={() =>
                      setSelectedCoin(
                        coin
                      )
                    }
                  >
                    <CoinLogo
                      coin={coin}
                      size={40}
                    />

                    <span>
                      <b>
                        {coin.name}
                      </b>

                      <small>
                        {coin.symbol.toUpperCase()}
                      </small>
                    </span>

                    <strong>
                      {formatCurrency(
                        coin.current_price
                      )}
                    </strong>

                    <em
                      className={changeClass(
                        coin.price_change_percentage_24h
                      )}
                    >
                      {formatPercent(
                        coin.price_change_percentage_24h
                      )}
                    </em>
                  </button>
                ))}
            </div>
          )}
        </section>

        {/* PORTFOLIO */}

        <section
          className="section"
          id="portfolio"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                PORTFOLIO
              </div>

              <h2>
                Portfolio Tracker
              </h2>

              <p>
                Track investments locally
                without connecting a wallet
                or exchange.
              </p>
            </div>

            <button
              className="primary-small"
              type="button"
              onClick={() =>
                setShowPortfolioForm(
                  true
                )
              }
            >
              + Add position
            </button>
          </div>

          <div className="stats-grid portfolio-summary">
            <StatCard
              label="Total invested"
              value={`$${formatCompact(
                totalInvested
              )}`}
            />

            <StatCard
              label="Current value"
              value={`$${formatCompact(
                currentPortfolioValue
              )}`}
            />

            <StatCard
              label="Profit / Loss"
              value={`$${formatCompact(
                portfolioProfit
              )}`}
              sub={
                totalInvested
                  ? formatPercent(
                      (portfolioProfit /
                        totalInvested) *
                        100
                    )
                  : "—"
              }
            />
          </div>

          {portfolio.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">
                ◈
              </div>

              <h3>
                No portfolio positions
              </h3>

              <p>
                Add a cryptocurrency,
                quantity and purchase price.
              </p>
            </div>
          ) : (
            <div className="position-list">
              {portfolio.map(
                (item) => {
                  const coin =
                    coins.find(
                      (c) =>
                        c.id ===
                        item.coinId
                    );

                  const invested =
                    Number(
                      item.quantity
                    ) *
                    Number(
                      item.buyPrice
                    );

                  const current =
                    coin
                      ? Number(
                          item.quantity
                        ) *
                        Number(
                          coin.current_price
                        )
                      : 0;

                  const pnl =
                    current -
                    invested;

                  return (
                    <div
                      className="position-row"
                      key={item.id}
                    >
                      {coin && (
                        <CoinLogo
                          coin={coin}
                          size={38}
                        />
                      )}

                      <span>
                        <b>
                          {coin?.name ??
                            item.coinId}
                        </b>

                        <small>
                          {formatNumber(
                            item.quantity
                          )}{" "}
                          {coin?.symbol?.toUpperCase()}{" "}
                          · Buy{" "}
                          {formatCurrency(
                            item.buyPrice
                          )}
                        </small>
                      </span>

                      <strong>
                        {formatCurrency(
                          current
                        )}
                      </strong>

                      <em
                        className={changeClass(
                          pnl
                        )}
                      >
                        {formatPercent(
                          invested
                            ? (pnl /
                                invested) *
                                100
                            : 0
                        )}
                      </em>

                      <button
                        type="button"
                        onClick={() =>
                          setPortfolio(
                            (items) =>
                              items.filter(
                                (entry) =>
                                  entry.id !==
                                  item.id
                              )
                          )
                        }
                        aria-label="Remove portfolio position"
                      >
                        ×
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ALERTS */}

        <section
          className="section"
          id="alerts"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                ALERTS
              </div>

              <h2>
                Price Alerts
              </h2>

              <p>
                Alerts are checked whenever
                fresh market data arrives.
              </p>
            </div>

            <button
              className="primary-small"
              type="button"
              onClick={() =>
                setShowAlertForm(true)
              }
            >
              + Create alert
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">
                🔔
              </div>

              <h3>
                No active alerts
              </h3>

              <p>
                Create an alert such as
                Bitcoin above $100,000.
              </p>
            </div>
          ) : (
            <div className="alert-list">
              {alerts.map((alert) => {
                const coin =
                  coins.find(
                    (c) =>
                      c.id ===
                      alert.coinId
                  );

                return (
                  <div
                    className={`alert-row ${
                      alert.triggered
                        ? "triggered"
                        : ""
                    }`}
                    key={alert.id}
                  >
                    <span className="alert-icon">
                      🔔
                    </span>

                    <div>
                      <b>
                        {coin?.name ??
                          alert.coinId}{" "}
                        {alert.condition ===
                        "above"
                          ? "≥"
                          : "≤"}{" "}
                        {formatCurrency(
                          alert.price
                        )}
                      </b>

                      <small>
                        {alert.triggered
                          ? "Triggered"
                          : "Active"}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAlerts(
                          (items) =>
                            items.filter(
                              (item) =>
                                item.id !==
                                alert.id
                            )
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* COMPARE */}

        <section
          className="section"
          id="compare"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                ANALYSIS
              </div>

              <h2>
                Compare Assets
              </h2>

              <p>
                Compare up to three
                cryptocurrencies.
              </p>
            </div>
          </div>

          {compareData.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">
                ⇄
              </div>

              <h3>
                No coins selected
              </h3>

              <p>
                Use Compare on any market
                card.
              </p>
            </div>
          ) : (
            <div className="compare-table-wrapper">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>
                      Coin
                    </th>
                    <th>
                      Rank
                    </th>
                    <th>
                      Price
                    </th>
                    <th>
                      24h
                    </th>
                    <th>
                      Market Cap
                    </th>
                    <th>
                      Volume
                    </th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {compareData.map(
                    (coin) => (
                      <tr
                        key={coin.id}
                      >
                        <td>
                          <div className="table-coin">
                            <CoinLogo
                              coin={coin}
                              size={32}
                            />

                            <span>
                              <b>
                                {coin.name}
                              </b>

                              <small>
                                {coin.symbol.toUpperCase()}
                              </small>
                            </span>
                          </div>
                        </td>

                        <td>
                          #
                          {coin.market_cap_rank ??
                            "—"}
                        </td>

                        <td>
                          {formatCurrency(
                            coin.current_price
                          )}
                        </td>

                        <td
                          className={changeClass(
                            coin.price_change_percentage_24h
                          )}
                        >
                          {formatPercent(
                            coin.price_change_percentage_24h
                          )}
                        </td>

                        <td>
                          $
                          {formatCompact(
                            coin.market_cap
                          )}
                        </td>

                        <td>
                          $
                          {formatCompact(
                            coin.total_volume
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              toggleCompare(
                                coin.id
                              )
                            }
                            aria-label={`Remove ${coin.name}`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* TRENDING */}

        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                DISCOVERY
              </div>

              <h2>
                Trending Now
              </h2>

              <p>
                Trending assets supplied by
                CoinGecko.
              </p>
            </div>
          </div>

          <div className="trending-grid">
            {trending.map((item) => {
              const trend =
                item.item;

              const coin =
                coins.find(
                  (c) =>
                    c.id ===
                    trend.id
                );

              return (
                <button
                  type="button"
                  className="trending-card"
                  key={trend.id}
                  onClick={() => {
                    if (coin) {
                      setSelectedCoin(
                        coin
                      );
                    }
                  }}
                >
                  <img
                    src={
                      trend.large ||
                      trend.small
                    }
                    alt={`${trend.name} logo`}
                    loading="lazy"
                  />

                  <span>
                    <b>
                      {trend.name}
                    </b>

                    <small>
                      {trend.symbol}
                    </small>
                  </span>

                  <strong>
                    #
                    {trend.market_cap_rank ??
                      "—"}
                  </strong>
                </button>
              );
            })}
          </div>
        </section>

        {/* CREATOR */}

        <section
          className="creator-section"
          id="creator"
        >
          <div className="creator-card">
            <div className="creator-avatar">
              <img
                src={profileImage}
                alt="Harsh profile"
              />
            </div>

            <div className="creator-info">
              <div className="eyebrow">
                CREATOR
              </div>

              <h2>
                Harsh
              </h2>

              <p>
                Creator and developer of
                Meta Track.
              </p>

              <a
                className="instagram-link"
                href={CREATOR_INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
              >
                📸 Instagram
                <span>→</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}

      <footer className="footer">
        <div>
          <strong>
            ⚡ Meta Track
          </strong>

          <span>
            Fast cryptocurrency market
            intelligence.
          </span>
        </div>

        <div className="footer-credit">
          <span>
            103+ assets · Local-first
            features
          </span>

          <strong>
            by Harsh
          </strong>
        </div>
      </footer>

      {/* COIN DETAIL MODAL */}

      {selectedCoin && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedCoin(null);
            }
          }}
        >
          <div
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coin-detail-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() =>
                setSelectedCoin(null)
              }
              aria-label="Close details"
            >
              ×
            </button>

            <div className="detail-header">
              <div className="tracking-coin">
                <CoinLogo
                  coin={selectedCoin}
                  size={58}
                />

                <div>
                  <div className="eyebrow">
                    #
                    {selectedCoin.market_cap_rank ??
                      "—"}{" "}
                    MARKET CAP
                  </div>

                  <h2 id="coin-detail-title">
                    {selectedCoin.name}
                  </h2>

                  <span>
                    {selectedCoin.symbol.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="detail-price">
                <strong>
                  {formatCurrency(
                    selectedCoin.current_price
                  )}
                </strong>

                <span
                  className={changeClass(
                    selectedCoin.price_change_percentage_24h
                  )}
                >
                  {formatPercent(
                    selectedCoin.price_change_percentage_24h
                  )}
                </span>
              </div>
            </div>

            <div className="detail-stats">
              <StatCard
                label="Market cap"
                value={`$${formatCompact(
                  selectedCoin.market_cap
                )}`}
              />

              <StatCard
                label="24h volume"
                value={`$${formatCompact(
                  selectedCoin.total_volume
                )}`}
              />

              <StatCard
                label="Circulating supply"
                value={formatCompact(
                  selectedCoin.circulating_supply
                )}
              />

              <StatCard
                label="Total supply"
                value={formatCompact(
                  selectedCoin.total_supply
                )}
              />

              <StatCard
                label="Max supply"
                value={formatCompact(
                  selectedCoin.max_supply
                )}
              />

              <StatCard
                label="All-time high"
                value={formatCurrency(
                  selectedCoin.ath
                )}
              />

              <StatCard
                label="All-time low"
                value={formatCurrency(
                  selectedCoin.atl
                )}
              />

              <StatCard
                label="24h high"
                value={formatCurrency(
                  selectedCoin.high_24h
                )}
              />
            </div>

            <div className="chart-toolbar">
              <div>
                <b>
                  Price history
                </b>

                <span>
                  {chartRange}
                </span>
              </div>

              <div>
                {CHART_RANGES.map(
                  (range) => (
                    <button
                      type="button"
                      key={range}
                      className={
                        chartRange ===
                        range
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setChartRange(
                          range
                        )
                      }
                    >
                      {range}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="detail-chart">
              {chartLoading ? (
                <div className="chart-loading">
                  Loading chart...
                </div>
              ) : (
                <Chart
                  points={chartData}
                  positive={
                    Number(
                      selectedCoin.price_change_percentage_24h ??
                        0
                    ) >= 0
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* PORTFOLIO FORM */}

      {showPortfolioForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowPortfolioForm(
                false
              );
            }
          }}
        >
          <form
            className="form-modal"
            onSubmit={
              addPortfolioPosition
            }
          >
            <button
              className="modal-close"
              type="button"
              onClick={() =>
                setShowPortfolioForm(
                  false
                )
              }
            >
              ×
            </button>

            <div className="eyebrow">
              PORTFOLIO
            </div>

            <h2>
              Add position
            </h2>

            <label>
              Cryptocurrency

              <select
                value={
                  portfolioForm.coinId
                }
                onChange={(event) =>
                  setPortfolioForm(
                    (current) => ({
                      ...current,
                      coinId:
                        event.target.value,
                    })
                  )
                }
              >
                <option value="">
                  Select asset
                </option>

                {coins.map((coin) => (
                  <option
                    key={coin.id}
                    value={coin.id}
                  >
                    {coin.name} (
                    {coin.symbol.toUpperCase()}
                    )
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
                value={
                  portfolioForm.quantity
                }
                onChange={(event) =>
                  setPortfolioForm(
                    (current) => ({
                      ...current,
                      quantity:
                        event.target.value,
                    })
                  )
                }
                placeholder="0.25"
              />
            </label>

            <label>
              Buy price (USD)

              <input
                type="number"
                min="0"
                step="any"
                value={
                  portfolioForm.buyPrice
                }
                onChange={(event) =>
                  setPortfolioForm(
                    (current) => ({
                      ...current,
                      buyPrice:
                        event.target.value,
                    })
                  )
                }
                placeholder="50000"
              />
            </label>

            <button
              className="primary-button"
              type="submit"
            >
              Add position
            </button>
          </form>
        </div>
      )}

      {/* ALERT FORM */}

      {showAlertForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowAlertForm(false);
            }
          }}
        >
          <form
            className="form-modal"
            onSubmit={addAlert}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() =>
                setShowAlertForm(false)
              }
            >
              ×
            </button>

            <div className="eyebrow">
              PRICE ALERT
            </div>

            <h2>
              Create alert
            </h2>

            <label>
              Cryptocurrency

              <select
                value={
                  alertForm.coinId
                }
                onChange={(event) =>
                  setAlertForm(
                    (current) => ({
                      ...current,
                      coinId:
                        event.target.value,
                    })
                  )
                }
              >
                <option value="">
                  Select asset
                </option>

                {coins.map((coin) => (
                  <option
                    key={coin.id}
                    value={coin.id}
                  >
                    {coin.name} (
                    {coin.symbol.toUpperCase()}
                    )
                  </option>
                ))}
              </select>
            </label>

            <label>
              Condition

              <select
                value={
                  alertForm.condition
                }
                onChange={(event) =>
                  setAlertForm(
                    (current) => ({
                      ...current,
                      condition:
                        event.target.value,
                    })
                  )
                }
              >
                <option value="above">
                  Price reaches / exceeds
                </option>

                <option value="below">
                  Price drops below
                </option>
              </select>
            </label>

            <label>
              Target price (USD)

              <input
                type="number"
                min="0"
                step="any"
                value={
                  alertForm.price
                }
                onChange={(event) =>
                  setAlertForm(
                    (current) => ({
                      ...current,
                      price:
                        event.target.value,
                    })
                  )
                }
                placeholder="100000"
              />
            </label>

            <button
              className="primary-button"
              type="submit"
            >
              Create alert
            </button>
          </form>
        </div>
      )}

      {notice && (
        <div
          className="toast"
          role="status"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

export default App;