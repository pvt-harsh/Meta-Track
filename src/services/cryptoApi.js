const API_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 45_000;

const cache = new Map();
const pendingRequests = new Map();

function getApiKey() {
  const key = import.meta.env.VITE_COINGECKO_API_KEY;

  if (!key) {
    throw new Error(
      "CoinGecko API key is missing. Add VITE_COINGECKO_API_KEY to your .env file."
    );
  }

  return key;
}

async function request(endpoint, params = {}, options = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const cacheKey = url.toString();
  const now = Date.now();

  if (!options.force) {
    const cached = cache.get(cacheKey);

    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = fetch(url.toString(), {
    headers: {
      "x-cg-demo-api-key": getApiKey(),
    },
  })
    .then(async (response) => {
      if (response.status === 429) {
        throw new Error(
          "CoinGecko rate limit reached. Please wait a moment before refreshing."
        );
      }

      if (!response.ok) {
        throw new Error(`CoinGecko returned HTTP ${response.status}.`);
      }

      const data = await response.json();

      cache.set(cacheKey, {
        timestamp: Date.now(),
        data,
      });

      return data;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, promise);

  return promise;
}

export function clearApiCache() {
  cache.clear();
}

export function getMarkets(options = {}) {
  return request(
    "/coins/markets",
    {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 250,
      page: 1,
      sparkline: true,
      price_change_percentage: "1h,24h,7d,30d",
      locale: "en",
    },
    options
  );
}

export function getGlobalMarket(options = {}) {
  return request("/global", {}, options);
}

export function getTrending(options = {}) {
  return request("/search/trending", {}, options);
}

export function getCoinChart(id, range) {
  const days =
    range === "1H"
      ? 1
      : range === "24H"
        ? 1
        : range === "7D"
          ? 7
          : range === "30D"
            ? 30
            : range === "1Y"
              ? 365
              : "max";

  return request(`/coins/${encodeURIComponent(id)}/market_chart`, {
    vs_currency: "usd",
    days,
    interval:
      range === "1Y" || range === "MAX" ? "daily" : undefined,
    precision: "2",
  });
}