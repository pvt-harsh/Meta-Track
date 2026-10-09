const CACHE_TTL = 45_000;
const DIRECT_BASE = "https://api.coingecko.com/api/v3";

const cache = new Map();
const inflight = new Map();
let proxyDead = false;

function buildProxyUrl(path, params) {
  const query = new URLSearchParams();
  query.set("path", path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, value);
  }
  return `/api/coingecko?${query.toString()}`;
}

function buildDirectUrl(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, value);
  }
  const qs = query.toString();
  return `${DIRECT_BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("CoinGecko rate limit reached. Please wait a moment and retry.");
    }
    throw new Error(data?.error || data?.status?.error_message || `API returned ${response.status}.`);
  }
  return data;
}

async function request(path, params = {}, { force = false } = {}) {
  const cacheKey = `${path}?${new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))
  ).toString()}`;

  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey);
  }

  const promise = (async () => {
    if (!proxyDead) {
      try {
        const data = await fetchJson(buildProxyUrl(path, params));
        cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      } catch (err) {
        if (String(err?.message).includes("rate limit")) throw err;
        proxyDead = true;
      }
    }
    const data = await fetchJson(buildDirectUrl(path, params));
    cache.set(cacheKey, { timestamp: Date.now(), data });
    return data;
  })().finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, promise);

  return promise;
}

export function clearApiCache() {
  cache.clear();
}

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
          sparkline: true,
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

export async function getFxRates(codes, { force = false } = {}) {
  const wanted = Array.from(new Set(["usd", ...codes]));
  const data = await request(
    "/simple/price",
    { ids: "bitcoin", vs_currencies: wanted.join(",") },
    { force }
  );
  const quote = data?.bitcoin;
  if (!quote?.usd) throw new Error("Exchange rates unavailable.");
  const rates = {};
  for (const code of wanted) {
    if (quote[code]) rates[code] = quote[code] / quote.usd;
  }
  return rates;
}
