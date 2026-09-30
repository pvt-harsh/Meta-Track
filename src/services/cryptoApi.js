const CACHE_TTL = 45_000;

const cache = new Map();
const inflight = new Map();

async function request(path, params = {}, { force = false } = {}) {
  const query = new URLSearchParams();

  query.set("path", path);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, value);
    }
  });

  const url = `/api/coingecko?${query.toString()}`;
  const cacheKey = url;

  if (!force) {
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
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

// Fetches several pages of 250 coins (CoinGecko's per-page maximum) in
// parallel. If page 1 fails, the error is thrown as before. If a later page
// fails (for example a rate limit), the pages that did load are still
// returned, so the app shows fewer coins instead of failing completely.
export async function getMarkets({
  force = false,
  currency = "usd",
  pages = 4,
} = {}) {
  const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1);

  const settled = await Promise.allSettled(
    pageNumbers.map((page) =>
      request(
        "/coins/markets",
        {
          vs_currency: currency,
          order: "market_cap_desc",
          per_page: 250,
          page,
          sparkline: false,
          price_change_percentage: "1h,24h,7d,30d,1y",
          locale: "en",
        },
        { force }
      )
    )
  );

  if (settled[0].status === "rejected") {
    throw settled[0].reason;
  }

  return settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

export function getGlobalMarket({ force = false } = {}) {
  return request("/global", {}, { force });
}

export function getTrending({ force = false } = {}) {
  return request("/search/trending", {}, { force });
}

export function getCoinChart(id, range, currency = "usd") {
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

  return request(`/coins/${encodeURIComponent(id)}/market_chart`, {
    vs_currency: currency,
    days,
    interval: range === "1Y" || range === "MAX" ? "daily" : undefined,
  }).then((data) => {
    if (range === "1H" && Array.isArray(data?.prices)) {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      return {
        ...data,
        prices: data.prices.filter(([timestamp]) => timestamp >= oneHourAgo),
      };
    }

    return data;
  });
}