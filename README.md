# Lading — Programmable Trade Escrow

Funds held per deal, released when the shipping documents check out.

Kwame in Accra buys $28,000 of auto parts from Rashid in Deira. Neither has met
the other. The money sits in an escrow account issued for that one deal, and is
released when the bill of lading checks out against the terms they agreed.

## Run it yourself

**On Windows, and never set this up before? Follow
[docs/WINDOWS.md](docs/WINDOWS.md)** — it starts from nothing installed and
assumes no prior experience.

You need **Node 22+** and **PostgreSQL 16**. Nothing else — no WeWire account,
no Twilio account, no cloud storage.

```bash
git clone <this repo> && cd Lading-App
git checkout claude/lading-app-implementation-wc99h6
npm install
```

### Just want to see the screens?

```bash
npm run dev:web
```

Open **http://localhost:5173/canvas** — all seventeen screens laid out at once
with their captions, exactly as the design document presents them. **No database
and no API needed**; the canvas makes zero network calls.

### The working app

```bash
npm run setup     # writes apps/api/.env with generated secrets
npm run db:setup  # creates the database and its tables
npm run dev       # API on :4000, app on :5173
```

Open **http://localhost:5173**.

`npm run setup` assumes PostgreSQL is reachable at `localhost:5432` with user
and password `postgres`. If yours differs, edit the `DATABASE_URL` line it
writes into `apps/api/.env` — that is the only line you should need to touch.

### Walking a whole deal

1. **Sign in.** Enter any phone number in international format, e.g.
   `+233244123456`. The six-digit code is **printed in the terminal**, in a
   box headed `SMS not sent — OTP_DELIVERY=log`. No SMS account required.
2. **Start a deal.** Fill in the counterparty, then goods and value (`28000.00`
   reproduces the design's figures), then send.
3. **Be the seller.** The deal screen shows an **invite link**. Open it in a
   private window — the seller has no account, which is the point — and accept.
4. **Fund it.** Back as the buyer, fund the escrow. The deal stays
   `AWAITING_FUNDING`: a client cannot prove money moved, so only a provider
   callback can complete it. Stand in for that callback:

   ```bash
   npm run dev:fund -- LD-1234      # the reference shown on the deal
   ```

5. **Present documents.** Upload a real PDF as the bill of lading, then present
   it. Release stays disabled until all five checks match — nothing parses a
   document yet, so record them by hand to continue:

   ```sql
   INSERT INTO "DocumentCheck" (id, "dealId", name, result)
   SELECT gen_random_uuid(), id, unnest(ARRAY['CONSIGNEE','GOODS_DESCRIPTION',
     'VESSEL_AND_VOYAGE','PORT_OF_DISCHARGE','SHIPPED_ON_BOARD_DATE'])::"CheckName",
     'MATCH' FROM "Deal" WHERE reference = 'LD-1234';
   ```

6. **Release** — or raise a discrepancy and watch the money freeze.

## Layout

| Package | What it is |
| --- | --- |
| `apps/web` | React + Vite. The seventeen screens. |
| `apps/api` | Fastify + Prisma + Postgres. |
| `packages/shared` | Money, the deal state machine, and the wire contracts. |

| Command | What it does |
| --- | --- |
| `npm run setup` | Generate `apps/api/.env` (safe to re-run) |
| `npm run db:setup` | Create the database and tables |
| `npm run dev` | Both halves at once |
| `npm test` | 52 tests |
| `npm run build` | Typecheck and build everything |
| `npm run dev:fund -- <REF>` | Stand in for a provider funding callback |

## How it holds together

**Money is integer minor units, never floats.** A locked FX rate is a scaled
integer, so the figure quoted on day 0 replays exactly on day 26 — the guarantee
the product sells.

**The deal state machine decides when money may move.** There is no edge from
`DISCREPANCY` to `RELEASE`, so "nobody can move the money while a discrepancy is
open — including us" is enforced by the shape of the graph rather than by
remembering to check.

**Ground.** A screen declares `ink` (buyer) or `paper` (seller) and every
primitive reads remapped variables from it, which is what makes the seller's
screens unmistakable. Oxide appears only where value moves or a condition is
met. Nothing interactive is under 44px tall.

**Providers are seams.** Escrow, SMS and document storage each have a real
implementation and a development stand-in, so the whole journey runs with no
third-party account. `log` codes and `disk` storage are refused at boot when
`NODE_ENV=production`.

## What is not done

- **WeWire has never been contacted.** The client is written to the published
  API and tested against a stubbed transport, but verifying it needs a
  `sk_test_` key. It runs on an in-memory provider meanwhile.
- **Nothing parses a bill of lading.** The five checks are recorded and
  enforced; producing them is manual (see step 5 above).
- **KYB documents are not stored.** Only deal documents upload for real.
- **The TestFlight pipeline has never run.** See [docs/TESTFLIGHT.md](docs/TESTFLIGHT.md).
- No app icon, no push notifications, no deep linking.

## Design source of record

`design/` holds the Claude Design files this was built from — `Lading App.dc.html`
(the seventeen screens) and `Lading Identity.dc.html` (palette and type). They
are prototypes, not production code. The bundle also shipped a `support.js`; it
is the design tool's own runtime, so it is deliberately not ported.
