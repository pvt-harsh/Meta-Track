const get = {
  rank: (c) => c.market_cap_rank ?? 1e9,
  name: (c) => c.name?.toLowerCase() ?? "",
  price: (c) => Number(c.current_price ?? 0),
  change: (c) => Number(c.price_change_percentage_24h ?? -1e9),
  marketCap: (c) => Number(c.market_cap ?? 0),
  volume: (c) => Number(c.total_volume ?? 0),
};

export const DEFAULT_DIR = { rank: "asc", name: "asc" };

export function sortCoins(list, by, dir) {
  const fn = get[by] ?? get.rank;
  const m = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = fn(a), y = fn(b);
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * m;
  });
}

export function searchCoins(list, q) {
  const term = q.trim().toLowerCase();
  if (!term) return list;
  return list.filter((c) => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term) || String(c.market_cap_rank) === term);
}
