# eTIMS AutoInvoice

M-Pesa payments matched to orders, fiscalized with KRA eTIMS, and delivered to
the buyer as a digital receipt.

## Layout

| Path | What is there |
| --- | --- |
| `web/` | The Next.js frontend. See `web/README.md`. |
| `backend/` | Express API: auth, orders, payments, KRA eTIMS fiscalization, M-Pesa callbacks, receipts, SMS. |
| `database/migrations/` | SQL migrations, run by `backend/scripts/migrate.js`. |
| `assets/` | Images used by the frontend. |

## Running it

```bash
docker compose up --build
```

The frontend is on port 8081 and proxies `/api/*` to the backend over the
internal network. Copy `.env.example` to `.env` first; the backend refuses to
start without `JWT_SECRET`, `ENC_KEY`, `HMAC_KEY` and `MPESA_CALLBACK_TOKEN`.

Without Docker:

```bash
cd backend && npm install && npm run db:migrate && npm start
```

```bash
cd web && npm install && npm run dev
```

## The old static frontend

`*.html`, `css/` and `js/` at the repository root are the previous vanilla
frontend. Everything in them has been ported to `web/`, and nothing serves them
any more — `docker-compose.yml` now builds `web/` in place of the nginx
container. They are kept only so the port can be compared against the original,
and can be deleted once you are happy with it.
