# Lading — Programmable Trade Escrow

Funds held per deal, released when the shipping documents check out.

This is an implementation of the `Lading App` design: the complete deal journey,
17 screens across 5 stages, built as a real navigable app rather than a mockup.

The reference deal throughout is **LD-4471** — Kwame (buyer, Accra) and Rashid
(seller, Deira), $28,000 of auto parts over 26 days.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Types only |

## Two surfaces

- **`/`** — the app. Walk the journey end to end: sign in → verify → write the
  deal → seller accepts → fund → the 26 days → documents → release → certificate.
- **`/canvas`** — every screen laid out at once with its caption, mirroring the
  source design document. A review surface; previews are frozen (`inert`).

## The journey

| Stage | Screens | Routes |
| --- | --- | --- |
| 01 Get verified | 01–02 | `/`, `/verify` |
| 02 Write the deal | 03–06 | `/deals`, `/deal/new/counterparty`, `/deal/new/terms`, `/deal/new/review` |
| 03 Accept and fund | 07–10 | `/seller/accept`, `/deal/account`, `/deal/fund`, `/deal/funded` |
| 04 The 26 days | 11–14 | `/deal`, `/seller/present`, `/deal/verification`, `/deal/discrepancy` |
| 05 Release and record | 15–17 | `/deal/released`, `/deal/certificate`, `/deals` (populated) |

Home (`/deals`) is one screen with two states — empty until a deal has settled,
then the trade record. Releasing funds on `/deal/verification` flips it.

## How the design is encoded

**Ground.** A screen declares `ground="ink"` (buyer) or `ground="paper"`
(seller); every primitive reads remapped CSS variables from that. This is why
one component set renders both views with no per-screen branching, and why
seller screens are unmistakable — they arrive on paper, banded `SELLER VIEW`.

**Oxide is not decoration.** `#8a3a24` appears only where value moves or a
condition is met: the live selection, a met check, `FUNDED`/`RELEASED`, the
released bar in the mark. Explanatory rules use slate (`#1f3a4d`) instead.

**Tap targets.** Nothing interactive is under 44px tall — enforced globally in
`src/styles/global.css`, not per component.

Tokens live in `src/styles/tokens.css`, primitives in `src/components/`, the
LD-4471 figures in `src/data/deal.ts`. Figures are held as strings taken from
the design rather than recomputed, because the product's claim is that the rate
is locked for the full window — nothing should derive GHS from USD at render
time.

## Layout note

Two screens — `/deal/new/terms` (+40px) and `/deal/new/review` (+44px) — have
slightly more content than fits an 844px device once real text metrics apply, so
their content scrolls and the primary action sits just below the fold at rest.
The design's spacing has been kept exactly as specified rather than tightened;
if the CTA should always be visible, either trim a gap or pin the footer outside
the scroll region. Every other screen fits with no overflow.

## Design source of record

`design/` holds the files this was built from:

- `Lading App.dc.html` — the 17-screen journey
- `Lading Identity.dc.html` — palette and type

These are Claude Design prototypes (HTML/CSS/JS), not production code. The
handoff bundle also shipped a `support.js`; it is the design tool's own
`dc-runtime` (it parses `<x-dc>` templates for the preview environment), so it
is tooling rather than product code and is deliberately not ported.

## Stack

React 18 · TypeScript · Vite · React Router. No UI framework — the design's
type and spacing are specific enough that one would only get in the way.
