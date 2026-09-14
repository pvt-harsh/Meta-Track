const API_BASE = "https://api.coingecko.com/api/v3";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "CoinGecko API key is not configured.",
      });
    }

    const { path, ...params } = req.query;

    if (!path) {
      return res.status(400).json({
        error: "Missing CoinGecko API path.",
      });
    }

    const cleanPath = String(path).startsWith("/")
      ? String(path)
      : `/${path}`;

    const url = new URL(`${API_BASE}${cleanPath}`);

    Object.entries(params).forEach(([key, value]) => {
      if (key !== "path" && value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        "x-cg-demo-api-key": apiKey,
      },
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("CoinGecko proxy error:", error);

    return res.status(500).json({
      error: "Unable to contact CoinGecko.",
    });
  }
}