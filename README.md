# ReFx Business Manager

An all-in-one, self-hosted business manager for **small businesses that buy and sell
inventory** and need to know their real **profit and margins** — not a stack of
disconnected tools. The spine of the app is the **buy → sell → profit** loop. Every
product also gets a **media gallery** (photos/videos) and an optional way to **publish
that media to Facebook/Instagram**, so marketing lives right next to the inventory it
promotes.

Built with **Next.js 15** (App Router) · **Prisma + SQLite** · **Tailwind + shadcn/ui** ·
**Recharts** · **react-hook-form + zod** · **sharp** (+ optional `ffmpeg`).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your env file (defaults work out of the box)
cp .env.example .env

# 3. Create the database + run migrations
npx prisma migrate dev

# 4. Seed realistic sample data (items, sales, purchases, expenses, images…)
npm run seed

# 5. Run it
npm run dev
```

Open **http://localhost:3000**.

**Demo login:** password **`demo1234`** (set via `AUTH_PASSWORD` in `.env`). Set
`AUTH_ENABLED=false` for a purely-local, no-login setup.

> The seed wipes and repopulates the database each run, so you always get a clean,
> profitable demo business (≈$20k revenue, ~43% gross / ~20% net margin over 90 days).

---

## Install it like an iOS app (PWA)

The app is a **mobile-first installable PWA** with a native-style shell — a top bar,
a 6-tab bottom bar (Home · Dashboard · Inventory · Products · Socials · Finances), and
a green theme. To put it on your iPhone home screen (runs fullscreen, no Safari chrome):

1. Deploy it to an **https** URL (see "How can I deploy this" in the project notes) and open it in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the new icon — it opens standalone, like a native app.

It ships a web app manifest (`/manifest.webmanifest`), iOS meta tags, app icons, and a
conservative service worker (`/public/sw.js`) that gives an offline shell without caching
business data. Set `OWNER_NAME` in `.env` to change the dashboard greeting ("Good
morning, <name> 👋"). On desktop the same app renders centered at phone width.

> A true App Store build (Capacitor wrapper or React Native) is possible later but needs a
> Mac + Xcode; the PWA gives the native look/feel today with no build toolchain.

---

## The core loop (the point of the app)

1. **Buy stock** (Purchases) → increases quantity on hand, **recomputes the item's
   moving-average cost**, and records a purchase/expense.
2. **Sell stock** (Sales) → decreases quantity, **snapshots the cost of goods sold at the
   moment of sale**, records revenue, and computes gross profit + margin for that sale.
3. **Other expenses** (rent, wages, fees…) reduce net profit but don't touch inventory.
4. Everything aggregates into **profit & margin reporting**:
   `revenue − COGS = gross profit` and `gross profit − operating expenses = net profit`,
   with margins at the item, sale, product, category, and whole-business level.

---

## How money, dates & costing work

### Money — integer cents, never floats
All monetary values are stored as **integer minor units (cents)**. There is a single
`money` utility (`src/lib/money.ts`) for parsing, formatting, and margin/markup math; all
arithmetic happens in integers and values are only formatted to a string at the UI edge.
This avoids floating-point rounding drift in financial totals.

### Dates
Stored as ISO/UTC `DateTime` in the DB; displayed in the **user's local timezone** via
`toLocaleString`. Date inputs use `YYYY-MM-DD` local values.

### Costing — moving weighted-average + COGS snapshot
- The costing method is **moving weighted-average**. Each stock receipt recomputes the
  item's average unit cost:
  `newAvg = (oldQty·oldAvg + recvQty·unitCost) / (oldQty + recvQty)`
  (guarded so a zero/negative on-hand base falls back to the incoming cost).
- When an item is **sold**, the *current* average cost is **snapshotted onto the sale
  line** (`SaleLine.unitCostSnapshot`). Realized profit on past sales is therefore
  **locked in** and never changes retroactively when later purchases shift the average.
- **Inventory valuation** = Σ(quantity × current average cost).
- Manual stock adjustments (`+/-` with a reason) write a `StockMovement` and **do not**
  change the average cost (there's no cost attached to an adjustment).

### Overselling behavior
Recording a sale **blocks overselling by default**: if a line's quantity exceeds the
on-hand amount, the sale form shows an explicit **overselling warning** listing the
affected items and the available quantity. You can then either cancel and fix the
quantities, or click **"Sell anyway"** to proceed and allow stock to go negative (useful
for backorders / pre-counted stock). The decision is explicit — nothing is silently
overdrawn.

---

## Features

| Area | What you get |
|---|---|
| **Dashboard** | This period's revenue, gross profit, gross margin %, net profit; inventory value; low-stock list; best/worst-margin products; outstanding receivables/payables; recent sales; revenue-vs-profit trend chart. |
| **Inventory** | CRUD items (name, SKU auto/manual, category, unit, qty, system-maintained avg cost, sale price, reorder threshold, supplier, notes). Search/filter/sort, low-stock badges, primary-image thumbnails. Item detail shows margin & markup, stock value, gallery, price history, stock-movement history, and manual stock adjust. |
| **Purchases** | Multi-line stock receipts → increase qty, recompute moving-average cost, write stock movements, record on the payables side. |
| **Sales** | Multi-line sales → decrement stock, snapshot COGS, per-line & per-sale gross profit + margin, overselling guard, printable invoice, paid/unpaid status. |
| **Expenses & income** | Non-inventory outgoings with categories, optional non-sale income, paid/unpaid tracking (receivables/payables). |
| **Profit & Reports** | Whole-business P&L over a selectable period; per-item / per-category profitability (sortable, with best/worst margins flagged); revenue-vs-profit and margin-over-time trend charts. |
| **Media gallery** | Drag-and-drop image/video upload with web-optimized variants + thumbnails; responsive grid, lightbox, drag-to-reorder, captions/alt text, set primary image, delete. |
| **Gallery view** | Standalone view aggregating all product media, filterable by item / category / type. |
| **Social publishing** | Optional, config-gated Facebook Page + Instagram Business publishing (see below). |
| **Documents** | Upload PDFs/images with title, type (invoice/receipt/contract/other) and optional links to contacts/sales/purchases/items; preview/download. |
| **Contacts** | Customers & suppliers with details, linked to their sales/purchases/supplied items. |

---

## Media handling & the `ffmpeg` dependency

- **Images** are processed with **`sharp`** on upload: a web-optimized variant
  (max 1600px, mozjpeg) and a 400px square thumbnail are generated, and width/height are
  recorded. No external image binaries are required.
- **Videos** are stored as-is. A **poster/thumbnail frame** and **duration** are extracted
  with **`ffmpeg`/`ffprobe`**, which are an **optional system dependency**:
  - If `ffmpeg` + `ffprobe` are on `PATH`, video uploads get a generated poster frame.
  - If they are **not installed**, video still uploads and plays — it just shows a generic
    placeholder instead of a generated poster. The app degrades gracefully.
  - Install: `apt-get install ffmpeg` (Debian/Ubuntu) · `brew install ffmpeg` (macOS).
- Limits are configurable in `.env` (`MAX_IMAGE_SIZE_MB`, `MAX_VIDEO_SIZE_MB`,
  `MAX_VIDEO_DURATION_SECONDS`).
- **Storage** lives behind a small interface (`src/lib/storage.ts`). The default writes to
  the local filesystem under `/uploads` and serves files via `/api/files/[...key]`. It also
  exposes a **`publicUrl(key)`** (built from `PUBLIC_BASE_URL`) — required for Instagram
  publishing. To move to S3-compatible object storage later, implement the same
  `put/get/delete/publicUrl` interface and export it from that file; nothing else changes.
- **Seed media is images only.** Generating a real sample video requires `ffmpeg`, so the
  seed creates product photos (via `sharp`) and you can upload a video from any item's
  gallery to exercise the video path.

---

## Social publishing — Facebook & Instagram (optional)

This feature is **completely optional and gated by configuration**. If Meta isn't set up,
the app runs normally and the per-media **Share** button shows setup guidance plus a
**fallback "copy caption & open platform"** flow instead of erroring.

It's built behind a pluggable `SocialPublisher` interface (`src/lib/social/`) with
`facebook` and `instagram` providers, following the **current Meta Graph API + Instagram
Content Publishing API** (pin the version via `META_GRAPH_VERSION`, default `v21.0`).

### What it can do
- **Facebook Page** photo/video posts via the Graph API. Publishing targets a **Page you
  manage** — personal-profile publishing via the API is not available.
- **Instagram** posts to an **IG Business/Creator account linked to that Page** (not
  personal IG accounts), using the **container → (poll status for video) → publish** flow.
  Instagram **fetches media from a public URL**, so the app serves media at
  `PUBLIC_BASE_URL/api/files/...`.

### Setup (full)
1. **Create a Meta app** at <https://developers.facebook.com/> (Business type). Add the
   *Facebook Login* and *Instagram* products.
2. Put the credentials in `.env`:
   ```
   META_APP_ID="…"
   META_APP_SECRET="…"
   META_OAUTH_REDIRECT_URI="https://YOUR_PUBLIC_URL/api/social/oauth/callback"
   META_GRAPH_VERSION="v21.0"
   PUBLIC_BASE_URL="https://YOUR_PUBLIC_URL"
   ```
   Register the **exact** redirect URI in the app's Facebook Login settings.
3. **Link an Instagram Business/Creator account** to the Facebook Page you'll publish to
   (IG app → Settings → linked Facebook Page; the Page must be one you manage).
4. In the app, go to **Settings → Connections → Connect Facebook & Instagram**. This runs
   the OAuth flow, stores a **long-lived Page token**, picks the target Page, and resolves
   the linked IG account. Connection status + a **post log** (every attempt: media,
   platform, target, status, external id/permalink, error) are shown there and per item.
5. Use the **Share** action on any gallery image/video to choose target(s) (FB Page and/or
   IG), edit the caption (prefilled from item name + price), and publish.

### Important caveats
- **App Review:** Meta requires **App Review** (scopes like `pages_manage_posts`,
  `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`,
  `instagram_basic`, `business_management`) before this works for anyone beyond your app's
  **developer/test users**. During development, add yourself as a test user.
- **Public URL is required for Instagram.** IG fetches `image_url`/`video_url` from the
  internet, so `PUBLIC_BASE_URL` must be a reachable **https** URL. For local testing, run a
  tunnel and point `PUBLIC_BASE_URL` (and the OAuth redirect) at it:
  ```bash
  ngrok http 3000          # or: cloudflared tunnel --url http://localhost:3000
  ```
  The Connections page shows whether your current `PUBLIC_BASE_URL` is publicly reachable.
- **Rate limits / errors** from the Graph API are surfaced to the user and recorded in the
  post log; long-lived tokens are stored and can be refreshed.

---

## Connecting Shopify & Etsy (platform sync)

**Drawer → Shopify / Etsy** (`/integrations`). Optional and gated — the app runs
fully without it. It imports **orders → Sales**, **products → Items/Products**, and
**buyers → Contacts**, deduped via an `ExternalLink` table (provider + external id) so
nothing double-counts, and every action is written to a **sync log**. Sales are tagged
with a `source` (`manual` / `shopify` / `etsy`) to power the **Sales-by-channel** comparison.
Two-way sync (push products + inventory *out*) is gated behind a per-platform toggle.

### Shopify (works immediately with a custom app)
1. Shopify admin → **Settings → Apps and sales channels → Develop apps → Create an app**.
2. Give it Admin API scopes: `read_products, write_products, read_orders, read_customers,
   read_inventory, write_inventory`. Install it and copy the **Admin API access token** (`shpat_…`).
3. In ReFx: **Integrations → Shopify**, enter your `your-shop.myshopify.com` domain + the token → **Connect**, then **Sync now**.
4. Toggle **Two-way sync** on to push products/inventory back to Shopify (uses the Admin REST API, version `SHOPIFY_API_VERSION`, default `2026-01`).

### Etsy (needs an app keystring; production needs review)
1. Create an app at <https://www.etsy.com/developers/your-apps> and copy the **keystring** (the `x-api-key`). Put it in `.env` as `ETSY_KEYSTRING` (this *enables* Etsy in the app).
2. Etsy reads/writes use **OAuth 2.0 (PKCE)** with scopes like `transactions_r`, `listings_r`, `listings_w`. Obtain an access token + your **shop id**, then **Integrations → Etsy → Connect**.
3. **App Review:** Etsy production access requires Etsy's app-review; dev/personal access works immediately for your own shop.

### Notes / caveats
- **Live testing needs real store credentials.** The import/dedupe **mapping logic is unit-tested** with mock payloads, but end-to-end runs require your Shopify/Etsy keys.
- **Imported items start with unknown cost (avg cost 0)** — record a purchase or set the average cost so imported orders show accurate profit (revenue is correct immediately).
- Imported orders **do not decrement local stock** (the platform already fulfilled them); inventory is reconciled via two-way sync instead.
- API endpoints are pinned to current versions (Shopify `2026-01`; Etsy Open API v3) — verify against the platforms' docs at build time, as they version their APIs.
- The in-app **OAuth helper flow** (so you don't paste tokens manually) and TikTok Shop / Amazon Handmade are the next steps on the integration roadmap.

---

## Backup & restore

Your data is two things: the **SQLite file** (`prisma/dev.db`) and the **`/uploads`**
folder (media + documents). Both are git-ignored.

```bash
# Create a timestamped tarball under ./backups (uses sqlite3 online backup if available)
./scripts/backup.sh

# Restore (stop the app first):
tar -xzf backups/refx-backup-YYYYMMDD-HHMMSS.tar.gz
cp refx-data/prisma/dev.db prisma/dev.db
cp -r refx-data/uploads ./uploads
```

A manual backup is just: copy `prisma/dev.db` and the `uploads/` folder somewhere safe.

---

## Data model

`Item` · `Contact` · `Sale`/`SaleLine` · `Purchase`/`PurchaseLine` · `Expense` ·
`StockMovement` · `PriceLog` · `Media` · `SocialConnection` · `SocialPost` · `Document`.
See `prisma/schema.prisma` — it's documented inline. Money fields are integer cents;
`SaleLine.unitCostSnapshot` is the locked-in COGS.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run seed` | Wipe + reseed sample data |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:reset` | Drop, re-migrate, reseed |
| `npm run db:studio` | Prisma Studio (browse the DB) |
| `./scripts/backup.sh` | Back up DB + uploads |

---

## Notable engineering decisions

- **Integer-cents money** with a single `money` util — no floats anywhere in financial math.
- **Moving-average costing with a per-sale COGS snapshot** so realized profit is immutable.
  (FIFO/LIFO are out of scope for v1.)
- **Rolled-up sale/purchase totals are stored** (`revenue/cogs/grossProfit/total`) so
  reports don't recompute them on every read; per-line detail is preserved for drill-down.
- **SQLite via Prisma** for one-file backup; the schema avoids SQLite-only features so
  switching `provider`/`url` to Postgres is a one-line change. Quantities are `Float` to
  support fractional units (kg/m/L); money stays integer.
- **Storage interface** with a `publicUrl` capability — local FS today, S3 tomorrow,
  and the public URL is what makes Instagram publishing possible.
- **Social is pluggable and fully optional** — unconfigured, the app never errors and
  offers a copy-caption fallback.
- **Minimal single-account auth** — one password, signed HMAC session cookie, toggleable
  via `AUTH_ENABLED`. No user table (single-tenant by design).
- **Server Actions + route handlers**: actions for transactional writes (sales, purchases,
  CRUD) and route handlers for multipart uploads (`/api/media`, `/api/documents`) and OAuth.
- Validation with **zod** on every form (client via react-hook-form, re-validated on the
  server). Friendly errors, empty states, loading/progress UI throughout.

## Out of scope for v1 (future work)

Multi-currency, multi-tenant/teams, full double-entry accounting, FIFO/LIFO costing, tax
filing, payment-gateway integration, scheduled/queued social posts, other social networks,
and a native mobile app.
