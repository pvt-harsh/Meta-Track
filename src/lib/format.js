export const CURRENCIES = [
  { code: "usd", label: "US Dollar", symbol: "$" },
  { code: "inr", label: "Indian Rupee", symbol: "₹" },
  { code: "eur", label: "Euro", symbol: "€" },
  { code: "gbp", label: "British Pound", symbol: "£" },
  { code: "jpy", label: "Japanese Yen", symbol: "¥" },
  { code: "aud", label: "Australian Dollar", symbol: "A$" },
  { code: "cad", label: "Canadian Dollar", symbol: "C$" },
  { code: "sgd", label: "Singapore Dollar", symbol: "S$" },
  { code: "aed", label: "UAE Dirham", symbol: "AED" },
  { code: "brl", label: "Brazilian Real", symbol: "R$" },
  { code: "zar", label: "South African Rand", symbol: "R" },
  { code: "krw", label: "South Korean Won", symbol: "₩" },
];

export const NUMBER_FORMATS = [
  { id: "en-US", label: "1,234,567.89", hint: "International" },
  { id: "en-IN", label: "12,34,567.89", hint: "Indian (lakh / crore)" },
  { id: "de-DE", label: "1.234.567,89", hint: "European" },
];

export const DATE_FORMATS = [
  { id: "dmy", label: "DD/MM/YYYY" },
  { id: "mdy", label: "MM/DD/YYYY" },
  { id: "ymd", label: "YYYY-MM-DD" },
];

export const TIMEZONES = [
  { id: "auto", label: "Device timezone" },
  { id: "UTC", label: "UTC" },
  { id: "Asia/Kolkata", label: "India (IST, UTC+5:30)" },
  { id: "Asia/Dubai", label: "Dubai (GST)" },
  { id: "Asia/Singapore", label: "Singapore (SGT)" },
  { id: "Asia/Tokyo", label: "Tokyo (JST)" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Berlin", label: "Central Europe" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
];

export const REGIONS = [
  { id: "in", label: "India", currency: "inr", numberFormat: "en-IN", dateFormat: "dmy", timeFormat: "12h", timezone: "Asia/Kolkata" },
  { id: "us", label: "United States", currency: "usd", numberFormat: "en-US", dateFormat: "mdy", timeFormat: "12h", timezone: "auto" },
  { id: "uk", label: "United Kingdom", currency: "gbp", numberFormat: "en-US", dateFormat: "dmy", timeFormat: "24h", timezone: "Europe/London" },
  { id: "eu", label: "Eurozone", currency: "eur", numberFormat: "de-DE", dateFormat: "dmy", timeFormat: "24h", timezone: "Europe/Berlin" },
  { id: "ae", label: "UAE", currency: "aed", numberFormat: "en-US", dateFormat: "dmy", timeFormat: "12h", timezone: "Asia/Dubai" },
  { id: "sg", label: "Singapore", currency: "sgd", numberFormat: "en-US", dateFormat: "dmy", timeFormat: "12h", timezone: "Asia/Singapore" },
];

const state = {
  currency: "usd",
  rate: 1, 
  numberFormat: "en-US",
  dateFormat: "dmy",
  timeFormat: "12h",
  timezone: "auto",
};

export function configureFormat(next) {
  Object.assign(state, next);
}
export function getFormatState() {
  return state;
}
export function currencyMeta(code = state.currency) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

const cache = new Map();
function nf(key, opts) {
  const k = `${state.numberFormat}|${key}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(state.numberFormat, opts);
    cache.set(k, f);
  }
  return f;
}

const valid = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

export const toActive = (usd) => Number(usd) * state.rate;
export const fromActive = (amount) => Number(amount) / state.rate;

export function formatPrice(usd) {
  if (!valid(usd)) return "—";
  const v = toActive(usd);
  const abs = Math.abs(v);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return nf(`cur:${state.currency}:${digits}`, {
    style: "currency",
    currency: state.currency.toUpperCase(),
    minimumFractionDigits: abs >= 1 ? 2 : 2,
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatMoneyCompact(usd) {
  if (!valid(usd)) return "—";
  const v = toActive(usd);
  const num = nf("compact", { notation: "compact", maximumFractionDigits: 2 }).format(v);
  return `${currencyMeta().symbol}${num}`;
}

export function formatMoney(usd, digits = 2) {
  if (!valid(usd)) return "—";
  return nf(`money:${state.currency}:${digits}`, {
    style: "currency",
    currency: state.currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toActive(usd));
}

export function formatCompact(value) {
  if (!valid(value)) return "—";
  return nf("compact", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatNumber(value, max = 4) {
  if (!valid(value)) return "—";
  return nf(`num:${max}`, { maximumFractionDigits: max }).format(Number(value));
}

export function formatInt(value) {
  if (!valid(value)) return "—";
  return nf("int", { maximumFractionDigits: 0 }).format(Number(value));
}

export function formatPercent(value, digits = 2, signed = true) {
  if (!valid(value)) return "—";
  const n = Number(value);
  const body = nf(`pct:${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n));
  const sign = n < 0 ? "−" : signed && n > 0 ? "+" : "";
  return `${sign}${body}%`;
}

export const tone = (v) => (!valid(v) ? "flat" : Number(v) > 0 ? "up" : Number(v) < 0 ? "down" : "flat");

function tzOpt() {
  return state.timezone === "auto" ? {} : { timeZone: state.timezone };
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    ...tzOpt(), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const [dd, mm, yyyy] = [get("day"), get("month"), get("year")];
  if (state.dateFormat === "mdy") return `${mm}/${dd}/${yyyy}`;
  if (state.dateFormat === "ymd") return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
}

export function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    ...tzOpt(), hour: "numeric", minute: "2-digit", hour12: state.timeFormat === "12h",
  }).format(d);
}

export function formatDateTime(value) {
  if (!value) return "—";
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(value);
}
