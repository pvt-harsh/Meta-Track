import { useMemo, useState } from "react";
import { Field, PageHeader } from "../components/ui";
import Icon from "../components/Icon";
import CoinLogo from "../components/CoinLogo";
import { useData } from "../context/DataContext";
import { useDocumentTitle } from "../hooks";
import { formatNumber, formatPrice } from "../lib/format";

const num = (v) => (v === "" || v == null ? NaN : Number(v));
const ok = (...v) => v.every((x) => Number.isFinite(x));
const usd = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(v) < 1 ? 6 : 2 }).format(v);
const FIAT = "__fiat";

function Result({ label, value, tone }) {
  return <div className="calc-result"><span>{label}</span><strong className={tone ? `pct-${tone}` : ""}>{value}</strong></div>;
}

function Converter() {
  const { coins } = useData();
  const options = useMemo(() => coins.slice(0, 250), [coins]);
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("bitcoin");
  const [to, setTo] = useState(FIAT);

  const priceOf = (id) => (id === FIAT ? 1 : options.find((c) => c.id === id)?.current_price);
  const a = num(amount), pf = priceOf(from), pt = priceOf(to);
  const valid = ok(a, pf, pt) && pt > 0;
  const result = valid ? (a * pf) / pt : null;
  const swap = () => { setFrom(to); setTo(from); };
  const fromCoin = options.find((c) => c.id === from);
  const toCoin = options.find((c) => c.id === to);

  const select = (id, value, onChange, withFiat) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {withFiat && <option value={FIAT}>Cash (your currency)</option>}
      {options.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.symbol.toUpperCase()})</option>)}
    </select>
  );

  return (
    <section className="card calc">
      <h2>Converter</h2>
      <p className="muted">Convert between any two assets using live prices. “Cash” uses the currency chosen in Settings.</p>
      <div className="calc-grid">
        <Field label="Amount" htmlFor="cv-amt"><input id="cv-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="From" htmlFor="cv-from">{select("cv-from", from, setFrom, true)}</Field>
        <button type="button" className="btn calc-swap" onClick={swap} aria-label="Swap assets">⇄</button>
        <Field label="To" htmlFor="cv-to">{select("cv-to", to, setTo, true)}</Field>
      </div>
      <div className="calc-out" aria-live="polite">
        {valid ? (
          <>
            <div className="calc-big">
              {fromCoin && <CoinLogo coin={fromCoin} size={26} />}
              <span>{formatNumber(a, 8)} {from === FIAT ? "" : fromCoin?.symbol.toUpperCase()}</span>
              <em>=</em>
              {toCoin && <CoinLogo coin={toCoin} size={26} />}
              <strong>{to === FIAT ? formatPrice(result) : `${formatNumber(result, 8)} ${toCoin?.symbol.toUpperCase()}`}</strong>
            </div>
            {from !== FIAT && to !== FIAT && <small className="muted">1 {fromCoin?.symbol.toUpperCase()} = {formatNumber(pf / pt, 8)} {toCoin?.symbol.toUpperCase()}</small>}
          </>
        ) : <span className="muted">Enter an amount to convert.</span>}
      </div>
    </section>
  );
}

function ProfitLoss() {
  const [f, setF] = useState({ invest: "1000", buy: "", sell: "", fee: "0.1" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const invest = num(f.invest), buy = num(f.buy), sell = num(f.sell), fee = num(f.fee || 0);
  const valid = ok(invest, buy, sell, fee) && invest > 0 && buy > 0 && sell >= 0;
  const r = useMemo(() => {
    if (!valid) return null;
    const qty = (invest * (1 - fee / 100)) / buy;
    const gross = qty * sell;
    const proceeds = gross * (1 - fee / 100);
    const profit = proceeds - invest;
    return { qty, proceeds, profit, roi: (profit / invest) * 100, breakeven: (buy / ((1 - fee / 100) ** 2)) };
  }, [valid, invest, buy, sell, fee]);

  return (
    <section className="card calc">
      <h2>Profit &amp; loss</h2>
      <p className="muted">What a trade returns after fees on both the buy and the sell. All values in USD.</p>
      <div className="calc-grid calc-grid-4">
        <Field label="Invested (USD)" htmlFor="pl-inv"><input id="pl-inv" inputMode="decimal" value={f.invest} onChange={set("invest")} /></Field>
        <Field label="Buy price" htmlFor="pl-buy"><input id="pl-buy" inputMode="decimal" value={f.buy} onChange={set("buy")} placeholder="e.g. 60000" /></Field>
        <Field label="Sell price" htmlFor="pl-sell"><input id="pl-sell" inputMode="decimal" value={f.sell} onChange={set("sell")} placeholder="e.g. 75000" /></Field>
        <Field label="Fee per trade (%)" htmlFor="pl-fee"><input id="pl-fee" inputMode="decimal" value={f.fee} onChange={set("fee")} /></Field>
      </div>
      <div className="calc-results" aria-live="polite">
        {r ? (<>
          <Result label="Profit / loss" value={`${r.profit >= 0 ? "+" : ""}${usd(r.profit)}`} tone={r.profit > 0 ? "up" : r.profit < 0 ? "down" : "flat"} />
          <Result label="Return" value={`${r.roi >= 0 ? "+" : ""}${r.roi.toFixed(2)}%`} tone={r.roi > 0 ? "up" : r.roi < 0 ? "down" : "flat"} />
          <Result label="You receive" value={usd(r.proceeds)} />
          <Result label="Units bought" value={formatNumber(r.qty, 8)} />
          <Result label="Break-even sell price" value={usd(r.breakeven)} />
        </>) : <span className="muted">Enter your buy and sell prices to see the result.</span>}
      </div>
    </section>
  );
}

function RiskCalc() {
  const [f, setF] = useState({ account: "10000", risk: "1", entry: "", stop: "", target: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const account = num(f.account), risk = num(f.risk), entry = num(f.entry), stop = num(f.stop), target = num(f.target);
  const valid = ok(account, risk, entry, stop) && account > 0 && risk > 0 && entry > 0 && stop > 0 && entry !== stop;
  const r = useMemo(() => {
    if (!valid) return null;
    const riskUsd = account * (risk / 100);
    const perUnit = Math.abs(entry - stop);
    const units = riskUsd / perUnit;
    const size = units * entry;
    const long = stop < entry;
    const reward = ok(target) && target > 0 ? (long ? target - entry : entry - target) * units : null;
    return { riskUsd, units, size, long, reward, rr: reward != null ? reward / riskUsd : null, pctOfAcc: (size / account) * 100 };
  }, [valid, account, risk, entry, stop, target]);

  return (
    <section className="card calc">
      <h2>Position size</h2>
      <p className="muted">How much to buy so a stop-out costs only the share of your account you choose. Works for long and short. USD.</p>
      <div className="calc-grid calc-grid-5">
        <Field label="Account (USD)" htmlFor="rk-acc"><input id="rk-acc" inputMode="decimal" value={f.account} onChange={set("account")} /></Field>
        <Field label="Risk per trade (%)" htmlFor="rk-risk"><input id="rk-risk" inputMode="decimal" value={f.risk} onChange={set("risk")} /></Field>
        <Field label="Entry price" htmlFor="rk-entry"><input id="rk-entry" inputMode="decimal" value={f.entry} onChange={set("entry")} /></Field>
        <Field label="Stop price" htmlFor="rk-stop"><input id="rk-stop" inputMode="decimal" value={f.stop} onChange={set("stop")} /></Field>
        <Field label="Target (optional)" htmlFor="rk-tp"><input id="rk-tp" inputMode="decimal" value={f.target} onChange={set("target")} /></Field>
      </div>
      <div className="calc-results" aria-live="polite">
        {r ? (<>
          <Result label={`Direction`} value={r.long ? "Long" : "Short"} />
          <Result label="Amount at risk" value={usd(r.riskUsd)} tone="down" />
          <Result label="Position size" value={usd(r.size)} />
          <Result label="Units" value={formatNumber(r.units, 8)} />
          <Result label="% of account" value={`${r.pctOfAcc.toFixed(1)}%`} />
          {r.rr != null && <Result label="Reward : risk" value={`${r.rr.toFixed(2)} : 1`} tone={r.rr >= 1 ? "up" : "down"} />}
        </>) : <span className="muted">Enter an entry and a stop price to size the trade.</span>}
      </div>
    </section>
  );
}

const TOOL_META = [
  { id: "convert", name: "Converter", desc: "Convert between crypto and cash at live market prices.", icon: "compare", cat: "Convert" },
  { id: "pl", name: "Profit & loss", desc: "What a trade returns after fees on the buy and the sell.", icon: "trendUp", cat: "Trade" },
  { id: "risk", name: "Position size", desc: "Size a position so a stop-out costs only what you risk.", icon: "shield", cat: "Trade" },
];
const CATS = ["All", "Convert", "Trade"];
const TOOL_BODY = {
  convert: <Converter />,
  pl: <ProfitLoss />,
  risk: <RiskCalc />,
};

export default function Tools() {
  useDocumentTitle("Tools");
  const { fmtKey } = useData();
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TOOL_META.filter((t) =>
      (cat === "All" || t.cat === cat) &&
      (!needle || `${t.name} ${t.desc} ${t.cat}`.toLowerCase().includes(needle)));
  }, [q, cat]);
  const active = TOOL_META.find((t) => t.id === open);

  return (
    <div data-fmt={fmtKey}>
      <PageHeader eyebrow="Tools" title="Calculators"
        description="Three purpose-built calculators for converting and trading. Everything runs in your browser." />
      {open && active ? (
        <div className="tool-detail" key={active.id}>
          <button type="button" className="btn btn-ghost btn-sm tool-back" onClick={() => setOpen(null)}>
            <Icon name="chevronLeft" size={15} /> All tools
          </button>
          {TOOL_BODY[active.id]}
        </div>
      ) : (
        <>
          <div className="tools-bar">
            <label className="tools-search">
              <Icon name="search" size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…" aria-label="Search tools" />
              {<button type="button" className={`tools-clear${q ? " show" : ""}`} onClick={() => setQ("")} aria-label="Clear search" tabIndex={q ? 0 : -1}><Icon name="close" size={14} /></button>}
            </label>
            <div className="chips" role="group" aria-label="Tool categories">
              {CATS.map((c) => (
                <button key={c} type="button" className={`chip${cat === c ? " active" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <div className="tools-grid">
              {filtered.map((t) => (
                <button key={t.id} type="button" className="tool-card" onClick={() => setOpen(t.id)} aria-label={`Open ${t.name}`}>
                  <span className="tool-ic"><Icon name={t.icon} size={18} /></span>
                  <span className="tool-tx"><b>{t.name}</b><i>{t.desc}</i></span>
                  <span className="tool-meta"><em>{t.cat}</em><Icon name="arrowRight" size={15} className="tool-go" /></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="tools-empty">
              <Icon name="search" size={22} />
              <b>No tools match “{q.trim()}”.</b>
              <p className="muted">Try a different search, or browse a category.</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setCat("All"); }}>Show all tools</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
