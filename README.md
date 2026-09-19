# SpendWise — Personal Expense Tracker
https://spendwise-7.vercel.app/



An intermediate-level full-stack project: a PHP REST API backend (PDO +
SQLite) with a hand-built, no-framework HTML/CSS/JS frontend — cards,
doughnut + bar charts (Chart.js), filters, search, an add/edit modal, and
a light/dark theme.

## Project structure

```
spendwise/
├── api/
│   ├── config.php          # DB connection, CORS headers, helpers
│   └── transactions.php    # REST endpoints (GET/POST/PUT/DELETE + summary)
├── css/style.css
├── js/script.js
├── index.html
├── vercel.json
└── README.md
```

## API reference

| Method | Endpoint                              | Purpose                          |
|--------|----------------------------------------|-----------------------------------|
| GET    | `/api/transactions.php`               | List transactions (filters: `type`, `category`, `month=YYYY-MM`, `search`) |
| GET    | `/api/transactions.php?action=summary`| Totals + category & month breakdown for the charts |
| POST   | `/api/transactions.php`               | Create a transaction (JSON body) |
| POST   | `/api/transactions.php?action=seed`   | Wipe and insert demo data |
| PUT    | `/api/transactions.php?id=5`          | Update transaction #5            |
| DELETE | `/api/transactions.php?id=5`          | Delete transaction #5            |

Body shape for POST/PUT:
```json
{ "title": "Groceries", "amount": 850, "type": "expense", "category": "Food", "date": "2026-09-19", "note": "" }
```

## Run locally

You need PHP 8+ installed (no Composer, no extra extensions beyond the
built-in `pdo_sqlite`, which ships with PHP by default).

```bash
cd spendwise
php -S localhost:8000
```

Open `http://localhost:8000` in your browser. The SQLite file
(`api/spendwise.db`) is created automatically on first request.

## Deploying to Vercel — please read this first

Vercel does **not** run PHP natively. Its official serverless runtimes
are Node.js, Python, Go and Ruby. To get PHP working there, this project
is wired up for the popular **community runtime `vercel-php`**
(`https://github.com/risan/vercel-php`), configured in `vercel.json`. As
long as that project stays available, `vercel deploy` will work with no
extra setup:

```bash
npm i -g vercel
cd spendwise
vercel
```

**The important catch — data persistence.** Vercel functions run in a
read-only filesystem except for `/tmp`, and `/tmp` is wiped every time
the function "cools down" (often within minutes, and always on a new
deploy). `config.php` already points the SQLite file at `/tmp` when it
detects it's running on Vercel, so the app will *work* — you can add,
edit, filter and delete transactions — but data can vanish between
visits. That's fine for a demo/portfolio piece, but not for something
you'd rely on day-to-day.

**For real persistence**, swap the PDO connection in `api/config.php`
for a hosted database and keep everything else in this project
unchanged (the frontend only talks JSON to `api/transactions.php`, so it
doesn't care what's behind it):
- **Turso** — SQLite-compatible, generous free tier, closest to a drop-in swap.
- **PlanetScale** or **Railway MySQL** — change the DSN to `mysql:host=...;dbname=...` and swap the `CREATE TABLE`'s `AUTOINCREMENT` for `AUTO_INCREMENT`.
- **Supabase** (Postgres) — similar swap, `SERIAL` instead of `AUTOINCREMENT`.

**Alternative:** if you'd rather avoid the community-runtime dependency
altogether, any classic PHP host works with zero code changes —
Railway, Render, Hostinger, InfinityFree, or a basic LAMP VPS. Just
upload the `spendwise/` folder as-is.

## Customizing

- Add/rename categories in `CATEGORIES` at the top of `js/script.js`.
- Currency is formatted as INR (₹) in `formatCurrency()` in `script.js` — change the locale/symbol there.
- Colors and the whole design system live as CSS variables at the top of `css/style.css`, including a full dark theme.
