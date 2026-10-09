# MetaTrack

Crypto market tracker — live prices, heatmap, watchlist, comparison, calculators, portfolio and price alerts.
**Use it instantly as a guest. Sign in only for portfolio, alerts and backups.**

**Stack:** React 19 · Vite · React Router · Supabase (auth + profiles) · CoinGecko via a Vercel serverless proxy.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```
`/api/*` functions need `vercel dev` (or a Vercel deploy); plain `vite` serves the UI only.

## What's new in this version
- **Cinematic landing page** (`/`): grey loader → circular iris reveal → orbiting card vortex around the wordmark, rotating-word tagline, dark/light ripple toggle, scroll sections, looping command-palette demo and a 3D coin ring.
- **Guest mode — no login wall.** The app opens straight to the dashboard. Sign-in is optional and lives in the top-right and Settings.
- **Account-gated features** are declared in one file, `src/lib/features.js`. Gate any action with `requireAuth("portfolio")` — it opens a non-blocking sheet with a *Continue as guest* option.
- **Guest → account merge:** after signing in, MetaTrack offers to merge the guest watchlist/portfolio/alerts.
- **New pages:** Market Heatmap (`/heatmap`) and Calculators (`/tools`: converter, profit & loss, position size).
- **Redesign:** new cool near-black palette with violet accent (dark-first; warm off-white light theme). All colours live in `src/styles/tokens.css`.
- The dashboard moved from `/` to `/dashboard`.

| | Guest | Free account |
|---|---|---|
| Markets, coin pages, heatmap, compare, calculators, command palette, watchlist (local) | ✅ | ✅ |
| Portfolio, price alerts | — | ✅ |
| Export / import backups, profile & dashboard | — | ✅ |

## Reusing the hero
```jsx
import OrbitHero from "./components/landing/OrbitHero";

<OrbitHero play={true} cardCount={44} speed={1} images={["/a.jpg", "/b.jpg"]} accentColor="#8b7cff">
  <div className="lp-text" data-orbit-text>…your centred content…</div>
</OrbitHero>
```
- `data-orbit-text` marks the block the cards should keep clear of.
- Loops are seamless by construction (orbits are `sin/cos` of time — nothing respawns).
- Pauses off-screen and in hidden tabs; honours *reduced motion*; auto-drops trails/blur/shadows if it can't hold ~30fps.
- Cards are procedurally generated coin art by default. Pass `images` (your own or licensed photos) to use covers instead.

## Environment
See `.env.example`. `COINGECKO_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only.

## Structure
- `src/styles/` — tokens, base, components, pages, `additions.css` (guest/heatmap/calculators), `landing.css`.
- `src/context/` — settings, auth (+ guest/`requireAuth`), market data, per-user store (guests use a local `guest` bucket).
- `src/pages/Landing.jsx`, `src/components/landing/OrbitHero.jsx` — the landing experience.
- `src/lib/features.js` — what needs an account.
- `api/coingecko.js` — allow-listed market-data proxy. `api/delete-account.js` — account deletion.

## How data works
- Prices are fetched once in USD; other currencies use live FX rates applied client-side.
- Watchlist, portfolio, alerts and notifications are stored in the browser, per account (guests: a `guest` bucket). No cross-device sync yet; Export/Import moves them.
- Alerts are evaluated whenever market data refreshes **while the app is open**.
