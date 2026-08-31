import { useEffect, useMemo, useState } from "react";
import "./App.css";
import profileImage from "./assets/profile.jpg";

const CREATOR_INSTAGRAM = "https://www.instagram.com/_pvt.hash/";

function App() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [compareCoins, setCompareCoins] = useState([]);

  useEffect(() => {
    async function fetchCoins() {
      try {
        setLoading(true);
        setError("");

        const apiKey = import.meta.env.VITE_COINGECKO_API_KEY;

        if (!apiKey) {
          throw new Error("CoinGecko API key was not found.");
        }

        const url =
          "https://api.coingecko.com/api/v3/coins/markets" +
          "?vs_currency=usd" +
          "&order=market_cap_desc" +
          "&per_page=20" +
          "&page=1" +
          "&sparkline=true" +
          "&price_change_percentage=24h";

        const response = await fetch(url, {
          headers: {
            "x-cg-demo-api-key": apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`CoinGecko returned ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected data received from CoinGecko.");
        }

        setCoins(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCoins();

    const refresh = setInterval(fetchCoins, 60000);

    return () => clearInterval(refresh);
  }, []);

  const filteredCoins = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return coins;
    }

    return coins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(term) ||
        coin.symbol.toLowerCase().includes(term)
    );
  }, [coins, search]);

  function toggleWatchlist(coinId) {
    setWatchlist((current) => {
      if (current.includes(coinId)) {
        return current.filter((id) => id !== coinId);
      }

      return [...current, coinId];
    });
  }

  function toggleCompare(coinId) {
    setCompareCoins((current) => {
      if (current.includes(coinId)) {
        return current.filter((id) => id !== coinId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, coinId];
    });
  }

  function formatCurrency(value) {
    if (value === null || value === undefined) {
      return "N/A";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  }

  function formatLargeNumber(value) {
    if (!value) {
      return "N/A";
    }

    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }

  function changeClass(value) {
    return value >= 0 ? "positive" : "negative";
  }

  const compareData = coins.filter((coin) =>
    compareCoins.includes(coin.id)
  );

  return (
    <div className={darkMode ? "app dark-theme" : "app light-theme"}>

      {/* NAVBAR */}
      <header className="navbar">
        <a className="logo" href="#home">
          <span className="logo-symbol">⚡</span>
          Meta Track
        </a>

        <nav>
          <a href="#home">Home</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#compare">Compare</a>
          <a href="#watchlist">Watchlist</a>
          <a href="#creator">Creator</a>
        </nav>

        <button
          className="theme-button"
          type="button"
          onClick={() => setDarkMode((value) => !value)}
          aria-label="Toggle theme"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </header>

      <main>

        {/* HERO */}
        <section className="hero" id="home">
          <div className="hero-content">

            <div className="status-badge">
              <span className="status-dot"></span>
              LIVE CRYPTO DATA
            </div>

            <h1>
              Track the Crypto Market
              <span> Smarter.</span>
            </h1>

            <p className="hero-description">
              Meta Track gives you a modern place to monitor
              cryptocurrency prices, compare assets, build a
              watchlist, and explore market performance.
            </p>

            <div className="hero-actions">
              <a href="#dashboard" className="primary-button">
                Explore Dashboard
              </a>

              <a href="#compare" className="secondary-button">
                Compare Coins
              </a>
            </div>

          </div>

          <div className="hero-card">
            <div className="hero-card-top">
              <span>Market Status</span>
              <span className="live-indicator">● Live</span>
            </div>

            <div className="hero-price">
              {loading ? "Loading..." : `${coins.length} Assets`}
            </div>

            <p>Cryptocurrencies currently tracked</p>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="section" id="dashboard">

          <div className="section-heading">
            <div>
              <div className="eyebrow">DASHBOARD</div>

              <h2>Market Overview</h2>

              <p>
                Explore current cryptocurrency prices and market data.
              </p>
            </div>

            <div className="search-wrapper">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search cryptocurrency..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>
          </div>

          {loading && (
            <div className="message-box">
              Loading live cryptocurrency data...
            </div>
          )}

          {!loading && error && (
            <div className="message-box error-box">
              <strong>Unable to load cryptocurrency data.</strong>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <div className="coin-grid">

              {filteredCoins.map((coin) => {
                const change =
                  coin.price_change_percentage_24h ?? 0;

                const isWatched = watchlist.includes(coin.id);
                const isCompared = compareCoins.includes(coin.id);

                return (
                  <div className="coin-card" key={coin.id}>

                    <div className="coin-card-top">
                      <button
                        className="coin-main-info"
                        type="button"
                        onClick={() => setSelectedCoin(coin)}
                      >
                        <img
                          src={coin.image}
                          alt={coin.name}
                        />

                        <div>
                          <h3>{coin.name}</h3>
                          <span>
                            {coin.symbol.toUpperCase()}
                          </span>
                        </div>
                      </button>

                      <button
                        className={
                          isWatched
                            ? "icon-button active"
                            : "icon-button"
                        }
                        type="button"
                        onClick={() => toggleWatchlist(coin.id)}
                        aria-label="Toggle watchlist"
                      >
                        {isWatched ? "★" : "☆"}
                      </button>
                    </div>

                    <div className="price-row">
                      <h3>
                        {formatCurrency(coin.current_price)}
                      </h3>

                      <span className={changeClass(change)}>
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                    </div>

                    <div className="coin-stats">

                      <div>
                        <span>Market Cap</span>
                        <strong>
                          ${formatLargeNumber(coin.market_cap)}
                        </strong>
                      </div>

                      <div>
                        <span>24h Volume</span>
                        <strong>
                          ${formatLargeNumber(coin.total_volume)}
                        </strong>
                      </div>

                    </div>

                    <div className="coin-actions">

                      <button
                        type="button"
                        onClick={() => setSelectedCoin(coin)}
                      >
                        View
                      </button>

                      <button
                        type="button"
                        className={
                          isCompared ? "selected-action" : ""
                        }
                        onClick={() => toggleCompare(coin.id)}
                      >
                        {isCompared ? "Compared" : "Compare"}
                      </button>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

          {!loading &&
            !error &&
            filteredCoins.length === 0 && (
              <div className="message-box">
                No cryptocurrency found for "{search}".
              </div>
            )}

        </section>

        {/* WATCHLIST */}
        <section className="section" id="watchlist">

          <div className="section-heading">
            <div>
              <div className="eyebrow">PERSONALIZED</div>
              <h2>Your Watchlist</h2>
              <p>
                Keep your favorite cryptocurrencies in one place.
              </p>
            </div>
          </div>

          {watchlist.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">☆</div>
              <h3>Your watchlist is empty</h3>
              <p>
                Click the star on any cryptocurrency to add it here.
              </p>
            </div>
          ) : (
            <div className="watchlist-grid">
              {coins
                .filter((coin) => watchlist.includes(coin.id))
                .map((coin) => (
                  <div className="watch-card" key={coin.id}>

                    <img
                      src={coin.image}
                      alt={coin.name}
                    />

                    <div>
                      <h3>{coin.name}</h3>
                      <p>{coin.symbol.toUpperCase()}</p>
                    </div>

                    <strong>
                      {formatCurrency(coin.current_price)}
                    </strong>

                  </div>
                ))}
            </div>
          )}

        </section>

        {/* COMPARE */}
        <section className="section" id="compare">

          <div className="section-heading">
            <div>
              <div className="eyebrow">ANALYSIS</div>
              <h2>Compare Cryptocurrencies</h2>
              <p>
                Select up to three cryptocurrencies for comparison.
              </p>
            </div>
          </div>

          {compareData.length === 0 ? (

            <div className="empty-card">
              <div className="empty-icon">⇄</div>
              <h3>No coins selected</h3>
              <p>
                Use the Compare button on dashboard cards.
              </p>
            </div>

          ) : (

            <div className="compare-table-wrapper">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Price</th>
                    <th>24h Change</th>
                    <th>Market Cap</th>
                    <th>Volume</th>
                  </tr>
                </thead>

                <tbody>
                  {compareData.map((coin) => {
                    const change =
                      coin.price_change_percentage_24h ?? 0;

                    return (
                      <tr key={coin.id}>
                        <td>
                          <div className="table-coin">
                            <img
                              src={coin.image}
                              alt={coin.name}
                            />

                            <span>{coin.name}</span>
                          </div>
                        </td>

                        <td>
                          {formatCurrency(coin.current_price)}
                        </td>

                        <td className={changeClass(change)}>
                          {change >= 0 ? "+" : ""}
                          {change.toFixed(2)}%
                        </td>

                        <td>
                          ${formatLargeNumber(coin.market_cap)}
                        </td>

                        <td>
                          ${formatLargeNumber(coin.total_volume)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          )}

        </section>

        {/* TRACKING */}
        <section className="section tracking-section">

          <div className="section-heading">
            <div>
              <div className="eyebrow">TRACKING</div>
              <h2>
                {selectedCoin
                  ? `${selectedCoin.name} Tracking`
                  : "Crypto Tracking"}
              </h2>

              <p>
                View the selected cryptocurrency and its recent
                market movement.
              </p>
            </div>
          </div>

          {selectedCoin ? (

            <div className="tracking-card">

              <div className="tracking-header">

                <div className="tracking-coin">
                  <img
                    src={selectedCoin.image}
                    alt={selectedCoin.name}
                  />

                  <div>
                    <h3>{selectedCoin.name}</h3>
                    <span>
                      {selectedCoin.symbol.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="tracking-price">
                  <strong>
                    {formatCurrency(
                      selectedCoin.current_price
                    )}
                  </strong>

                  <span
                    className={changeClass(
                      selectedCoin.price_change_percentage_24h ?? 0
                    )}
                  >
                    {(selectedCoin.price_change_percentage_24h ?? 0) >=
                    0
                      ? "+"
                      : ""}
                    {(
                      selectedCoin.price_change_percentage_24h ?? 0
                    ).toFixed(2)}
                    %
                  </span>
                </div>

              </div>

              <div className="chart-area">

                <div className="chart-line">
                  {(selectedCoin.sparkline_in_7d?.price || []).map(
                    (value, index, array) => {

                      if (!array.length) {
                        return null;
                      }

                      const min = Math.min(...array);
                      const max = Math.max(...array);
                      const range = max - min || 1;

                      const x =
                        (index /
                          Math.max(array.length - 1, 1)) *
                        100;

                      const y =
                        90 -
                        ((value - min) / range) *
                          75;

                      return (
                        <span
                          key={index}
                          className="chart-point"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        />
                      );
                    }
                  )}
                </div>

                <div className="chart-labels">
                  <span>7 Days Ago</span>
                  <span>Today</span>
                </div>

              </div>

            </div>

          ) : (

            <div className="empty-card">
              <div className="empty-icon">📈</div>
              <h3>Select a cryptocurrency</h3>
              <p>
                Click "View" on any dashboard card to see its
                tracking information here.
              </p>
            </div>

          )}

        </section>

        {/* CREATOR DASHBOARD */}
        <section className="creator-section" id="creator">

          <div className="creator-card">

            <div className="creator-avatar">
              <img src={profileImage} alt="Harsh profile" />
            </div>

            <div className="creator-info">

              <div className="eyebrow">
                CREATOR DASHBOARD
              </div>

              <h2>Harsh</h2>

              <p>
                Creator and developer of Meta Track.
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
          <strong>⚡ Meta Track</strong>
          <span>
            Cryptocurrency tracking platform
          </span>
        </div>

        <div className="footer-credit">
          <span>Meta Track</span>
          <strong>by Harsh</strong>
        </div>

      </footer>

    </div>
  );
}

export default App;
