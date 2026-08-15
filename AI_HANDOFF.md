# AI Handoff — OZELIF

## Primary objective

The current project objective is:
1. excellent technical SEO;
2. strong GEO / AI-search discoverability;
3. higher rankings for commercial search queries in Yandex and Google;
4. more organic enquiries and sales.

Do not optimize only for a Lighthouse SEO score.

Business KPI:
search query → impressions → position → CTR → visit → enquiry/order.

## Current production state

Website: https://ozelifkoja.ru
Project: `/opt/ozelif-website`
Frontend production root: `/var/www/ozelif-8091`
API: `127.0.0.1:8093`
Systemd: `ozelif-admin-api`

Canonical source code is primarily under:
- `src/`
- `server/`
- `scripts/`
- `public/`

Read `PROJECT_MAP.md` before editing.

## SEO work already completed

Technical foundation already exists:
- HTTPS
- canonical metadata
- sitemap
- robots.txt
- semantic prerender
- structured data
- real HTTP 404 handling
- category/product catalog
- internal SEO links

Wholesale page `/kozhaoptom` has already been substantially optimized.
Do not rewrite it without evidence that a change is needed.

## Current SEO subcategory engine

Generic engine:
- `src/components/CatalogSeoLandingPage.tsx`
- `src/data/catalogSeoLandings.ts`

Internal category links:
- `src/components/CatalogSeoSubcategoryLinks.tsx`

Current landing pages:
- `/dublyonka/kerli`
- `/dublyonka/toskana`
- `/odejnayakozha/perforirovannaya`
- `/odejnayakozha/krs`

Verified product counts:
- Кёрли: 20
- Тоскана: 6
- Перфорированная: 4
- КРС: 3

All four pages have been published and submitted to Yandex recrawl.

## Important matcher rule

DO NOT use generic product `description` to identify SEO subcategories.

Some shared shearling descriptions mention several material types,
which previously caused Кёрли to match all 55 shearling products.

Use:
- subtype
- product name/title
- slug

with normalization.

## Main open SEO problem

The four existing SEO subcategory pages render real products after React loads,
but their initial static/prerender HTML is still weaker than desired.

NEXT TECHNICAL PRIORITY:

Enhance the prerender pipeline so the initial semantic HTML contains
actual matching products and crawlable product links.

Target pages:
- `/dublyonka/kerli`
- `/dublyonka/toskana`
- `/odejnayakozha/perforirovannaya`
- `/odejnayakozha/krs`

The prerender should obtain real published products from PostgreSQL or
the canonical catalog data layer.

Initial HTML should contain actual:
- product name
- product URL
- price when present
- color when present
- thickness when present
- hide size when present
- origin/country when present
- coating when present

Do not invent missing values.

Also aggregate only genuine database values such as:
- available thicknesses
- hide sizes
- colors
- coatings
- countries/origins
- min/max price

## After that

Next priorities:
1. `/galantereynayakozha` currently has zero products:
   consider `noindex,follow` and removal from sitemap until inventory exists.
2. canonicalize trailing-slash duplicates using 301 where appropriate.
3. then consider `/dublyonka/merinos`.
4. build expert informational content.

Do not mass-produce thin SEO pages.

## Content accuracy rule

Do not claim that OZELIF manufactures/tans the leather itself unless
that statement is explicitly verified.

OZELIF has sewing production, but that does not automatically mean it is
the tannery/manufacturer of every leather material it sells.

## Product/database note

PostgreSQL uses `products.name`.
Frontend `PublicCatalogProduct` uses `title`.
Catalog APIs are paginated.

## Working preferences

When operating on the production server:
- use Russian explanations;
- prefer one complete shell block;
- make a backup first;
- use a subshell with `set -Eeuo pipefail`;
- do not guess filenames/functions;
- use a small read-only `grep/sed` inspection when structure is unclear;
- continue from the exact failed step instead of repeating completed work;
- do not repeatedly audit systems already proven to work;
- do not change ports/firewall/networking without a concrete need.
