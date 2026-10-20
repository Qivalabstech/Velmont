# VELMONT Store

A complete, self-hosted online store for VELMONT hand-tooled leather belts: storefront, checkout with Razorpay and cash on delivery, customer accounts with order tracking, an admin panel with staff roles, and a live Site health page for speed, SEO, AEO and GEO.

## What is included

**Storefront**
- Animated home page in the VELMONT theme (hero carousel, scrolling banner, craft section, size calculator, FAQ)
- Shop with category and tag filters, sorting and search
- Product pages with photo gallery and zoom, size picker with live stock, wishlist, reviews, size guide, related belts
- Bag drawer and bag page, discount codes
- One-page checkout: saved addresses, Razorpay (UPI, cards, netbanking, wallets) and cash on delivery
- Order confirmation, GST invoice (CGST/SGST or IGST by state), public order tracking with courier link
- Customer accounts: orders, addresses, wishlist, profile, password reset
- Info pages (About, Shipping, Exchanges, Care, Privacy, Terms), FAQ, Contact form
- SEO built in: per-page titles and descriptions, canonical URLs, sitemap.xml, robots.txt, llms.txt, and JSON-LD for Organization, WebSite, Product (price, stock, shipping, returns, ratings), BreadcrumbList and FAQPage

**Admin panel** (`/admin`)
| Section | What it does |
|---|---|
| Dashboard | Revenue, orders, average order, visitors, conversion, daily revenue chart, best sellers, low stock, orders to ship, COD to collect, abandoned bags |
| Orders | Tabs by status, search, filters, bulk confirm/pack, CSV export. Order page: status workflow with email to customer, courier + AWB with auto tracking links, timeline notes, address edit, refunds (through Razorpay or recorded manually), COD collected, staff notes, invoice, WhatsApp link |
| Customers | Account holders and guest checkouts, lifetime spend, block/unblock, CSV export |
| Products | Add, edit, duplicate, archive, delete. Photo upload (auto-converted to WebP), sizes with SKU and stock, pricing with MRP, GST and HSN, SEO fields with Google preview |
| Inventory | Edit stock for every size on one screen, low-stock view |
| Categories, Reviews | Shop filters; approve, hide or delete reviews (verified-buyer badge is automatic) |
| Discounts | Percent, rupees off or free shipping; minimum order, cap, total and per-customer limits, dates |
| Subscribers, Inbox | Newsletter sign-ups (CSV export) and Contact page messages |
| Homepage & pages | Announcement bar, hero text, banner words, store pages, FAQ |
| SEO & AI search | Listing audit for every page, site-wide titles, brand profiles, AI crawler switch, llms.txt summary, redirects |
| Site health | See below |
| Staff & roles | Add staff, assign roles, turn access off, reset passwords, create custom roles from 17 permissions |
| Activity log | Every staff change, every email sent, every error |
| Settings | Store and GST details, shipping and COD rules, Razorpay keys with connection test, order alert email |

**Staff roles.** The owner has full access. Five ready-made roles: Store Manager, Order Manager, SEO Manager, Catalogue Manager and Customer Support. Each staff member sees only the sections their role allows, and every server action re-checks permission.

**Site health** (`/admin/health`)
- Live: database, uptime (checked every 5 minutes, 24-hour strip), response time, payments mode, email, SSL expiry, last backup, errors, disk, memory
- Page speed: Google PageSpeed Insights for mobile and desktop (Lighthouse scores, LCP, CLS, TBT and real-user Core Web Vitals) once the site is public
- SEO: 17 checks over every page (titles, descriptions, H1, canonical, Open Graph, alt text, sitemap, robots, structured data, broken links, server speed)
- AEO (answer engines): FAQ schema, concise answers, Product and policy data, ratings, breadcrumbs, business identity
- GEO (AI search): AI crawler access, llms.txt coverage, description depth and uniqueness, product facts, brand profiles, reviews, freshness, server-rendered content
- Runs nightly at 3 am IST and on demand, with score history

## Tech stack
Next.js 15 (App Router, server actions) · React 19 · PostgreSQL 16 · Drizzle ORM · Razorpay · Nodemailer (SMTP) · Sharp · Caddy (automatic HTTPS) · Docker Compose. Fonts are self-hosted; there are no third-party trackers.

---

## Run it on your computer

Needs Node.js 22 and PostgreSQL 16.

```bash
npm install
cp .env.example .env            # set DATABASE_URL; keep PAYMENTS_MOCK=true for local testing
npm run db:migrate              # create tables
npm run db:seed                 # roles, the 4 belts, pages, FAQ, WELCOME10 code, owner account
npm run dev                     # http://localhost:3000  ·  admin at /admin
```
The seed prints the owner sign-in. Default when OWNER_EMAIL is not set: `owner@velmont.in` / `Velmont@2026`. Change it at once from *My account*.

With `PAYMENTS_MOCK=true` and no Razorpay keys, "Pay online" opens a test window so you can place orders without real money. Emails are logged under Activity log → Emails until SMTP is set.

---

## Put it live on Vercel

Vercel runs the store as serverless functions, so three things live outside it: the database (Neon), product photos (Vercel Blob) and scheduled jobs (Vercel Cron, set up by `vercel.json`).

> **Plan:** Vercel's Hobby plan is for non-commercial use only. A store that takes payments needs the **Pro** plan. Hobby also allows cron jobs only once a day, which this store already respects.

1. **Import the repo.** vercel.com → Add New → Project → pick the GitHub repo → keep the Next.js preset. Do not deploy yet if it asks; open the project settings first.
2. **Database.** Project → Storage → Create Database → **Neon** (Postgres) → connect it to the project. Vercel adds `DATABASE_URL` automatically. Choose the region closest to India (Singapore / ap-southeast-1) and set the project's Functions region to the same place (Settings → Functions).
3. **Photo storage.** Project → Storage → Create → **Blob** → connect it. Vercel adds `BLOB_READ_WRITE_TOKEN`.
4. **Environment variables** (Settings → Environment Variables, for Production):
   | Name | Value |
   |---|---|
   | `SITE_URL` | `https://yourdomain.in` (no trailing slash) |
   | `AUTH_SECRET` | long random string (`openssl rand -hex 32`, or any 64 random letters and numbers) |
   | `CRON_SECRET` | another long random string |
   | `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_PASSWORD` | your first admin login |
   | `PAYMENTS_MOCK` | `false` |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional here; can be set in Admin → Settings |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | your email provider |
5. **Deploy.** Deployments → Redeploy. The build runs `npm run vercel-build`, which creates the tables, adds the owner account and the 4 belts (only the first time), then builds the site.
6. **Domain.** Settings → Domains → add `yourdomain.in` and `www.yourdomain.in`, then add the DNS records Vercel shows at your domain registrar. HTTPS is automatic. Update `SITE_URL` if it changed and redeploy.
7. Continue with steps 4–10 of the server guide below (sign in at `/admin`, Razorpay keys and webhook, store details, health audit, Search Console, uptime monitor).

**Notes for Vercel**
- Add `https://yourdomain.in/api/health` to UptimeRobot (every 5 minutes). It alerts you if the site goes down and fills the uptime strip on the Site health page.
- Unpaid online orders release their stock at the next checkout, when staff open Orders, or in the daily job.
- Backups: Neon keeps restore points; check how many days your Neon plan keeps.
- New product photos are shrunk in the browser before upload; one save can carry up to about 4 MB of photos.

---

## Put it live on your own server

**You need:** a VPS with Ubuntu 22.04 or 24.04, 2 GB RAM or more (Hostinger KVM 2, DigitalOcean, AWS Lightsail all work), and your domain.

1. **Point the domain.** In your domain's DNS, add an `A` record for `@` and for `www` with the server's IP address.
2. **Install Docker** on the server:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. **Upload the project** to the server (for example `/opt/velmont`) with Git or SFTP, then:
   ```bash
   cd /opt/velmont
   cp .env.production.example .env
   nano .env          # fill DOMAIN, SITE_URL, passwords, OWNER_*, Razorpay, SMTP
   docker compose up -d --build
   docker compose exec app npx tsx scripts/seed.ts
   ```
   Caddy fetches the HTTPS certificate automatically within a minute.
4. **Sign in** at `https://yourdomain/admin` with the OWNER_EMAIL and OWNER_PASSWORD from `.env`, then change the password.
5. **Razorpay:** add live keys in `.env` or Admin → Settings → Payments and press *Test connection*. Then in the Razorpay Dashboard add the webhook `https://yourdomain/api/payments/webhook` with events `payment.captured`, `order.paid`, `payment.failed`, and paste its secret into settings.
6. **Email:** fill the SMTP lines in `.env` and run `docker compose up -d` again.
7. **Store details:** Admin → Settings: legal name, address, state and GSTIN (needed for correct GST invoices).
8. **Check health:** Admin → Site health → *Run SEO / AEO / GEO audit*, then *Test mobile* under Page speed.
9. **Search engines:** add the site to Google Search Console (paste the code in SEO & AI search → Site-wide) and submit `https://yourdomain/sitemap.xml`.
10. **Monitoring:** add `https://yourdomain/api/health` to UptimeRobot or Better Stack for downtime alerts.

### Before you take real orders
- [ ] Replace the product photos with your own photoshoot (the current photos came from another brand's listing)
- [ ] Live Razorpay keys, webhook set, one real ₹1 test order refunded
- [ ] SMTP working (Activity log → Emails shows "sent")
- [ ] GSTIN, legal name and address in Settings; GST rate for HSN 4203 confirmed with your accountant
- [ ] Owner password changed; staff added with the smallest role they need
- [ ] Privacy, Terms and Exchange pages read and adjusted to your policies
- [ ] Remove or edit the `WELCOME10` code in Discounts

### Day-to-day operations
| Task | Command |
|---|---|
| See logs | `docker compose logs -f app` |
| Update after code changes | `git pull && docker compose up -d --build` (migrations run automatically) |
| Backups | Automatic every 24 h into the `backups` volume (database + photos, 14 days kept) |
| List backups | `docker compose exec backup ls -lh /backups` |
| Copy a backup off the server | `docker compose cp backup:/backups ./backups-copy` |
| Restore database | `gunzip -c velmont-db-DATE.sql.gz \| docker compose exec -T db psql -U velmont -d velmont` |
| Reset the owner password | `docker compose exec app npx tsx scripts/create-owner.ts you@domain "Name" "NewPassword1"` |

Keep a copy of backups off the server (for example a weekly download to Google Drive).

## Project layout
```
src/app/(store)      storefront pages, checkout, account
src/app/admin        admin panel (each section has page.tsx + actions.ts)
src/app/(print)      invoices
src/app/api          payments verify + webhook, health, analytics, cron
src/lib              auth, cart, orders, Razorpay, email, settings, SEO, health checks, scheduler
src/db/schema.ts     database tables (Drizzle)
drizzle/             SQL migrations
scripts/             migrate, seed, create-owner, backup
deploy/              Caddyfile, backup loop
```

## Security notes
- Passwords hashed with bcrypt (cost 12); sessions are random tokens stored hashed, in httpOnly cookies; customer and staff sessions are separate
- Every admin page and server action checks the staff member's permission; staff sign-ins and changes are logged with IP
- Rate limits on sign-in, sign-up, password reset, checkout, contact form and order tracking
- Razorpay payments are confirmed only by signature check (browser) or signed webhook; amounts come from the server, never the browser
- Stock is locked in a database transaction at checkout so two shoppers cannot buy the last unit; unpaid online orders release stock after 30 minutes
