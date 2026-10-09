export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "home", end: true, key: "h" },
  { to: "/markets", label: "Markets", icon: "markets", key: "m" },
  { to: "/heatmap", label: "Heatmap", icon: "layers", key: "e" },
  { to: "/watchlist", label: "Watchlist", icon: "star", key: "w" },
  { to: "/compare", label: "Compare", icon: "compare", key: "c" },
  { to: "/portfolio", label: "Portfolio", icon: "portfolio", key: "p" },
  { to: "/tools", label: "Tools", icon: "grid", key: "t" },
  { to: "/alerts", label: "Alerts", icon: "bell", key: "a" },
  { to: "/settings", label: "Settings", icon: "settings", key: "s" },
];

export const SHORTCUTS = [
  { keys: ["Ctrl / ⌘", "K"], label: "Open search & command palette" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["G", "then", "H"], label: "Go to Dashboard" },
  { keys: ["G", "then", "M"], label: "Go to Markets" },
  { keys: ["G", "then", "E"], label: "Go to Heatmap" },
  { keys: ["G", "then", "T"], label: "Go to Tools" },
  { keys: ["G", "then", "W"], label: "Go to Watchlist" },
  { keys: ["G", "then", "C"], label: "Go to Compare" },
  { keys: ["G", "then", "P"], label: "Go to Portfolio" },
  { keys: ["G", "then", "A"], label: "Go to Alerts" },
  { keys: ["G", "then", "S"], label: "Go to Settings" },
  { keys: ["Esc"], label: "Close dialogs and menus" },
];
