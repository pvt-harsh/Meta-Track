const CACHE_TTL = 45_000;

const cache = new Map();
const inflight = new Map();

async function request(path, params = {}) {
  const query = new URLSearchParams();

  query.set("path", path);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, value);
    }
  });

  const url = `/api/coingecko?${query.toString()}`;
  const cacheKey = url;

  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey);
  }

  const promise = fetch(url)
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "CoinGecko rate limit reached. Please wait a moment and retry."
          );
        }

        throw new Error(
          data?.error ||
            data?.status?.error_message ||
            `API returned ${response.status}.`
        );
      }

      cache.set(cacheKey, {
        timestamp: Date.now(),
        data,
      });

      return data;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, promise);

  return promise;
}

export function clearApiCache() {
  cache.clear();
}

export function getMarkets() {
  return request("/coins/markets", {
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: 103,
    page: 1,
    sparkline: true,
    price_change_percentage: "24h",
    locale: "en",
  });
}

export function getGlobalMarket() {
  return request("/global");
}

export function getTrending() {
  return request("/search/trending");
}

export function getCoinChart(id, range) {
  const days =
    range === "1H" || range === "24H"
      ? 1
      : range === "7D"
        ? 7
        : range === "30D"
          ? 30
          : range === "1Y"
            ? 365
            : "max";

  return request(
    `/coins/${encodeURIComponent(id)}/market_chart`,
    {
      vs_currency: "usd",
      days,
      interval:
        range === "1Y" || range === "MAX"
          ? "daily"
          : undefined,
      precision: "2",
    }
  ).then((data) => {
    if (
      range === "1H" &&
      Array.isArray(data?.prices)
    ) {
      const oneHourAgo =
        Date.now() - 60 * 60 * 1000;

      return {
        ...data,
        prices: data.prices.filter(
          ([timestamp]) =>
            timestamp >= oneHourAgo
        ),
      };
    }

    return data;
  });
}