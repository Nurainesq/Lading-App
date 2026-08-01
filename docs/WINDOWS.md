# Running Lading on Windows

Written for someone who has never set this up before. It assumes nothing is
installed. Roughly 20 minutes, most of it waiting on installers.

You do **not** need a WeWire account, a Twilio account, or any cloud service.
Everything runs on your own machine.

---

## Step 1 — Install Node

Node is what runs the app.

1. Go to <https://nodejs.org>
2. Download the **LTS** installer (the left-hand button)
3. Run it and click Next through every screen. The defaults are correct.

## Step 2 — Install PostgreSQL

PostgreSQL is the database where deals are stored.

1. Go to <https://www.postgresql.org/download/windows/> and click
   **Download the installer**
2. Choose version **16**
3. Run it. Two screens matter:
   - **Password** — it asks you to set a password for the `postgres` user.
     **Write this down.** You need it in step 5.
   - **Port** — leave it at **5432**
4. Everything else: click Next.

At the end it offers "Stack Builder". You can untick it and finish.

## Step 3 — Get the code

No Git needed.

1. Go to the repository on GitHub
2. Click the branch dropdown (it says `main`) and choose
   **`claude/lading-app-implementation-wc99h6`**
3. Click the green **Code** button → **Download ZIP**
4. Right-click the downloaded ZIP → **Extract All**
5. Extract it somewhere simple, like `C:\lading`

## Step 4 — Open a terminal in that folder

1. Open the extracted folder in File Explorer, so you can see `package.json`
2. Click the address bar at the top, type `powershell`, press Enter

A blue window opens, already pointed at the right folder. Every command below
goes in that window.

## Step 5 — Set it up

Type each line and press Enter. Wait for one to finish before the next.

```powershell
npm install
```

Takes a couple of minutes and prints a lot. Warnings are normal; a line
starting with `npm error` is not.

```powershell
npm run setup
```

This writes your settings file and invents the secret keys for you.

**If you set a PostgreSQL password other than `postgres` in step 2**, open
`apps\api\.env` in Notepad and put your real password in the `DATABASE_URL`
line, between `postgres:` and `@localhost`:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/lading?schema=public
```

Then:

```powershell
npm run db:setup
```

This creates the database and its tables. It should end with
`Your database is now in sync with your Prisma schema.`

## Step 6 — Start it

```powershell
npm run dev
```

Leave this window open — closing it stops the app. When it settles you will
see a line like `➜  Local: http://localhost:5173/`.

Open **http://localhost:5173** in your browser.

---

## Using it

### Signing in

Type any phone number in international format — `+233244123456` is fine — and
press Continue.

**The code is not texted to you.** It appears in the PowerShell window, in a
box that looks like this:

```
  ┌─────────────────────────────────────────────
  │  SMS not sent — OTP_DELIVERY=log
  │  to    +233244123456
  │  CODE  418205
  └─────────────────────────────────────────────
```

Type those six digits into the app.

### Walking a deal

1. **Start a deal.** Counterparty name and phone, then goods and a value —
   `28000.00` reproduces the figures from the design.
2. **Send it.** You land on the deal, which now shows an **invite link**.
3. **Be the seller.** Copy that link and open it in a **private window**
   (`Ctrl+Shift+N` in Chrome or Edge). The seller has no account — that is the
   point of the product. Accept the terms there, then close it.
4. **Fund it.** Back in your normal window, fund the escrow.

   The deal stays on **awaiting funding**, and that is correct: the app cannot
   prove money actually moved, so only the bank's confirmation completes it.
   To stand in for that confirmation, open a **second** PowerShell window in
   the same folder (repeat step 4) and run — using the reference shown on the
   deal, e.g. `LD-4471`:

   ```powershell
   npm run dev:fund -- LD-4471
   ```

   Refresh the app. The deal is now funded.

5. **Documents.** Go to the deal and choose to present documents. Upload any
   real PDF as the bill of lading.

6. **Release.** "Release now" stays greyed out until all five document checks
   pass. Nothing reads a PDF yet, so there is no way to produce those checks
   through the app — see *Known dead end* below.

### Seeing all seventeen screens at once

Open **http://localhost:5173/canvas** — the whole journey side by side with
captions. This one works even with the database stopped.

---

## Known dead end

**You cannot reach the release or certificate screens through the app.**
Release requires five checks against the bill of lading, and nothing parses a
PDF yet, so the checks can never be produced by clicking. This is a genuine
missing feature, not a setup problem.

To get past it you have to insert them by hand. Open **pgAdmin** (installed
with PostgreSQL), connect with your password, pick the `lading` database, open
the Query Tool and run this, replacing `LD-4471` with your reference:

```sql
INSERT INTO "DocumentCheck" (id, "dealId", name, result)
SELECT gen_random_uuid(), id, unnest(ARRAY['CONSIGNEE','GOODS_DESCRIPTION',
  'VESSEL_AND_VOYAGE','PORT_OF_DISCHARGE','SHIPPED_ON_BOARD_DATE'])::"CheckName",
  'MATCH'
FROM "Deal" WHERE reference = 'LD-4471';
```

Refresh the deal and "Release now" becomes available.

---

## If something goes wrong

**`npm` is not recognised** — Node did not install, or the terminal was open
before you installed it. Close PowerShell, open a new one, try again.

**`Can't reach database server at localhost:5432`** — PostgreSQL is not
running. Press the Windows key, type `services.msc`, find `postgresql-x64-16`,
right-click → Start.

**`Authentication failed for user "postgres"`** — the password in
`apps\api\.env` does not match the one you set in step 2. Fix the
`DATABASE_URL` line and run `npm run db:setup` again.

**`Port 4000 is already in use`** — the app is already running in another
window. Close it, or press `Ctrl+C` in that window.

**`running scripts is disabled on this system`** — Windows is blocking npm.
Run this once, then try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**The page is blank** — the app is still starting. Wait for
`➜  Local: http://localhost:5173/` before opening the browser.

## Starting again later

You only do steps 1–5 once. After that:

```powershell
npm run dev
```
