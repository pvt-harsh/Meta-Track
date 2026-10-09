const API_BASE = "https://api.coingecko.com/api/v3";

const ALLOWED = [
  /^\/coins\/markets$/,
  /^\/coins\/[a-z0-9-]+\/market_chart$/,
  /^\/global$/,
  /^\/search\/trending$/,
  /^\/simple\/price$/,
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Market data service is not configured." });
  }

  const { path, ...params } = req.query;
  const clean = String(path ?? "");
  const normalized = clean.startsWith("/") ? clean : `/${clean}`;

  if (!path || !ALLOWED.some((rule) => rule.test(normalized))) {
    return res.status(400).json({ error: "Unsupported market data request." });
  }

  try {
    const url = new URL(`${API_BASE}${normalized}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const upstream = await fetch(url, { headers: { "x-cg-demo-api-key": apiKey } });
    const data = await upstream.json().catch(() => ({}));

    if (upstream.ok) res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error("CoinGecko proxy error:", error);
    return res.status(502).json({ error: "Unable to reach the market data provider." });
  }
}
