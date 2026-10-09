import { useState } from "react";

export default function CoinLogo({ coin, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const src = coin?.image || coin?.small || coin?.thumb;
  if (failed || !src) {
    return (
      <span className="coin-fallback" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
        {(coin?.symbol ?? "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <img className="coin-logo" src={src} width={size} height={size} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
