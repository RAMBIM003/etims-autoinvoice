# eTIMS AutoInvoice — web

The Next.js frontend. Next.js 16 (App Router), React 19, TypeScript, Tailwind
CSS v4 and shadcn/ui components built on Radix primitives.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`/api/*` is proxied to the Express API in `../backend`. Point it somewhere else
with `API_ORIGIN`:

```bash
API_ORIGIN=http://localhost:5000 npm run dev
```

The proxy is a route handler (`src/app/api/[...path]/route.ts`) rather than a
`rewrites()` entry, because rewrite destinations are compiled into the build.
Reading `API_ORIGIN` per request means one image works in compose, on a VPS and
locally.

## Layout

| Path | What is there |
| --- | --- |
| `src/app/page.tsx` | Marketing landing page |
| `src/app/(auth)/` | Sign in, registration for both roles, onboarding |
| `src/app/(app)/merchant/` | Dashboard, orders, payments, invoices, items, branches, connections, profile |
| `src/app/(app)/buyer/` | Purchases, receipts, profile |
| `src/app/receipt/[token]/` | Public fiscal receipt, no sign-in needed |
| `src/app/simulator/` | M-Pesa C2B payment simulator |
| `src/components/ui/` | shadcn/ui components |
| `src/lib/api.ts` | Typed client for every backend endpoint |
| `src/lib/types.ts` | Response shapes, mirroring `backend/routes/*.js` |

## Theming

Every colour is a CSS variable in `src/app/globals.css`: light values on
`:root`, dark values under `.dark`, which `next-themes` toggles. shadcn's own
variable names (`--background`, `--primary`, `--border`, …) are defined from the
same palette, so the components are on brand without per-component overrides.

To rebrand, edit the brand ramp at the top of that file. Nothing else needs
touching.

Charts take their colours as `var(--chart-1)` and similar written directly into
SVG attributes, so they follow the theme with no JavaScript.

## The sidebar

`src/components/ui/sidebar.tsx`. Collapses to a 56px icon rail on desktop, where
labels become tooltips; below the `md` breakpoint it is a drawer over a scrim
instead. The collapsed state is kept in the `etims_sidebar` cookie and read in
the server layout, so the first paint is already the right width. `Ctrl/Cmd+B`
toggles it.

## Tests

```bash
node test/mock-api.mjs 5099 &                      # stand-in for the Express API
API_ORIGIN=http://localhost:5099 npm run build && npm start
node test/e2e.mjs http://localhost:3000            # needs playwright on the machine
```

`test/e2e.mjs` loads every route at desktop and phone widths in both themes and
fails on a console error, horizontal overflow, or a page that renders none of
its expected content. It then exercises the sidebar collapse, the mobile drawer
and the theme toggle. Set `SHOT_DIR` to also write screenshots.

`test/mock-api.mjs` mirrors the real payload shapes from `backend/routes/*.js`;
keep it in step when those change.
