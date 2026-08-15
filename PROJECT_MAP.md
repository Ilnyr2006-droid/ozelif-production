# OZELIF Project Map

## Production

Website: https://ozelifkoja.ru

Server application directory:
- `/opt/ozelif-website`

Production frontend:
- `/var/www/ozelif-8091`

Backend/API:
- `/opt/ozelif-website/server`
- internal HTTP: `127.0.0.1:8093`
- systemd unit: `ozelif-admin-api`

PostgreSQL is used by the API.

## Canonical source code

When investigating or editing the current website, start here.

### Frontend
`src/`

Important areas:
- `src/App.tsx` — application routing
- `src/components/` — public website pages/components
- `src/components/cart/` — cart/checkout
- `src/admin/` — administration UI
- `src/api/` — frontend API clients
- `src/hooks/` — shared React hooks
- `src/data/` — frontend configuration/data
- `src/cart/` — cart state
- `src/styles.css` — main public styles

### Backend
`server/`

Important areas:
- `server/index.mjs` — API entry point
- `server/routes/` — API routes
- `server/lib/` — DB, catalog, auth, SEO, AI and business logic
- `server/sql/` — PostgreSQL migrations
- `server/scripts/` — server/admin scripts

### SEO / GEO
Important files:
- `scripts/prerender-static-seo.mjs`
- `server/lib/public-seo-html.mjs`
- `server/lib/public-category-seo.mjs`
- `server/lib/public-product-seo.mjs`
- `server/lib/public-sitemap.mjs`
- `public/robots.txt`
- `public/llms.txt`
- `public/sitemap.xml`
- `public/sitemap-categories.xml`

SEO category landing engine:
- `src/components/CatalogSeoLandingPage.tsx`
- `src/components/CatalogSeoSubcategoryLinks.tsx`
- `src/data/catalogSeoLandings.ts`

### Public catalog
Relevant backend:
- `server/lib/public-catalog.mjs`
- public catalog routes under `server/routes/`

Relevant frontend:
- `src/api/publicCatalog.ts`
- `src/hooks/usePublicCatalog.ts`

### Admin
Administration frontend lives under:
- `src/admin/`

Administration backend routes live under:
- `server/routes/admin-*.mjs`

The website and admin are part of the same project.

## Important warning about root-level files

There are historical/working copies at the repository root such as:
- `ApiCategoryPages.tsx`
- `ClothingLeatherCatalogPage.tsx`
- `CartCheckout.tsx`
- `CartProvider.tsx`
- `AdminTrafficAnalytics.tsx`
- `adminApiV2.ts`
- `index.mjs`
- `traffic-analytics.mjs`

Auditing showed that these files DIFFER from same-named files under
`src/` or `server/`.

DO NOT assume the root copy is the production implementation.
Before editing one of these root-level copies, verify that it is actually
referenced by package scripts/imports/runtime.

Normally treat `src/` and `server/` as the first places to inspect.

## Build

Main commands:
    npm run typecheck
    npm test
    npm run build

Build command performs:
1. TypeScript build
2. Vite production build
3. static SEO prerender

## Database terminology

PostgreSQL `products` uses:
- `name`

Frontend `PublicCatalogProduct` exposes:
- `title`

Do not accidentally query PostgreSQL using `products.title`.
Catalog API is paginated.

## Current SEO landing pages

- `/dublyonka/kerli`
- `/dublyonka/toskana`
- `/odejnayakozha/perforirovannaya`
- `/odejnayakozha/krs`

Known matching counts:
- Кёрли: 20
- Тоскана: 6
- Перфорированная кожа: 4
- КРС: 3

Matcher warning:
DO NOT match these groups using generic product `description`.

Some shearling descriptions mention multiple types such as
Меринос / Тоскана / Кёрли and would cause false matches.

Use structured subtype plus product name/title and slug.

## Empty category

`/galantereynayakozha` currently has zero published products.

Do not build aggressive SEO landing expansion around this category
until real products are available.

## Editing rule for AI agents

Before changing an unfamiliar part of the project:
1. inspect the current implementation;
2. identify the canonical file;
3. make a backup;
4. make the smallest necessary change;
5. run typecheck/tests/build;
6. smoke-test production after deploy.

Do not repeatedly re-audit already verified unrelated systems.
