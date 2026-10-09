const PATHS = {
  home: "M4 11.5 12 4l8 7.5M6 10v9h12v-9M10 19v-5h4v5",
  markets: "M4 19V10M10 19V5M16 19v-7M21 19H3",
  star: "m12 4 2.3 5.1 5.6.6-4.2 3.8 1.2 5.5L12 16.2 6.9 19l1.3-5.5-4.2-3.8 5.6-.6L12 4Z",
  compare: "M7 4v16M17 4v16M4 8h6M14 16h6M4 16h6M14 8h6",
  portfolio: "M3.5 8h17v11h-17zM8.5 8V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v2M3.5 13h17",
  bell: "M6 10a6 6 0 1 1 12 0c0 4 1.5 5.2 1.5 5.2h-15S6 14 6 10ZM10 18.5a2 2 0 0 0 4 0",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19.4 13a7.5 7.5 0 0 0 0-2l1.9-1.5-1.9-3.3-2.3.8a7.5 7.5 0 0 0-1.7-1L15 3.5h-3.8l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.8-1.9 3.3L6.8 11a7.5 7.5 0 0 0 0 2l-1.9 1.5 1.9 3.3 2.3-.8a7.5 7.5 0 0 0 1.7 1l.4 2.5H15l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.3.8 1.9-3.3Z",
  search: "M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.2-4.2",
  user: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c.9-3.3 3.4-5 7-5s6.1 1.7 7 5",
  logout: "M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10M13.5 8.5 17 12l-3.5 3.5M17 12H9",
  chevron: "m7 10 5 5 5-5",
  chevronRight: "m10 7 5 5-5 5",
  chevronLeft: "m14 7-5 5 5 5",
  chevronsLeft: "m12 7-5 5 5 5M18 7l-5 5 5 5",
  chevronsRight: "m12 7 5 5-5 5M6 7l5 5-5 5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 8l3 3",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  checkAll: "m2.5 12.5 4.5 4.5L16 8M10 16.5l1 .9L21 8",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  upload: "M12 16V5M7 9l5-5 5 5M5 20h14",
  keyboard: "M3.5 7h17v10h-17zM7 11h.01M10.5 11h.01M14 11h.01M17.5 11h.01M8 14.5h8",
  shield: "M12 3.5 5 6v5.5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6l-7-2.5ZM9 12l2.2 2.2L15.2 10",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7M12 16.7h.01",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  alert: "M12 4 3 19.5h18L12 4ZM12 10v4.5M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  camera: "M4 8.5h3l1.5-2h7l1.5 2h3v10H4v-10ZM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
  trendUp: "m4 16 5-5 4 4 7-8M15 7h5v5",
  trendDown: "m4 8 5 5 4-4 7 8M15 17h5v-5",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z",
  eyeOff: "M4 4l16 16M10 6a9 9 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.6M6.5 7.6A15 15 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.8-.8M9.9 9.9a2.8 2.8 0 0 0 4 4",
  mail: "M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  grid: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  sort: "M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3",
  layers: "m12 4 9 5-9 5-9-5 9-5ZM3 14l9 5 9-5",
};

export default function Icon({ name, size = 18, className = "", strokeWidth = 1.6, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
