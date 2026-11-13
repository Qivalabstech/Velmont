# VELMONT store: notes for Claude Code

Self-hosted e-commerce store for hand-tooled leather belts. Next.js 15 App Router + PostgreSQL + Drizzle. Owner is non-technical; keep admin copy plain and actionable.

## Commands
- `npm run dev`: dev server on :3000 (needs Postgres + .env; PAYMENTS_MOCK=true simulates Razorpay)
- `npm run typecheck`: must pass before finishing any change
- `npm run build`: production build (works without a database)
- `npm run db:generate`: after editing `src/db/schema.ts`, creates a migration in `drizzle/`
- `npm run db:migrate` / `npm run db:seed`

## Conventions
- Money is integer paise everywhere (`src/lib/money.ts` formats). Never store floats.
- Admin mutations are server actions wrapped in `run(permission, fn)` from `src/lib/admin-action.ts` (permission check, error handling, audit log). Admin pages start with `await requireStaff("perm")`.
- New admin section: add the permission in `src/lib/permissions.ts` (PERMISSIONS, PERMISSION_GROUPS, ADMIN_NAV), then `src/app/admin/(panel)/<section>/page.tsx` + `actions.ts`.
- Forms in admin use `<AForm action>` + `<Submit>` / `<ConfirmSubmit>` from `src/components/admin/Form.tsx`.
- Store settings live in the `settings` table, typed with defaults in `src/lib/settings.ts` (`getSettings`, `saveSetting`).
- Order state changes go through `src/lib/orders.ts` (createOrder, markPaid, updateOrderStatus, refundOrder, releaseExpiredOrders); allowed transitions are in `src/lib/order-status.ts`.
- Styling: plain CSS with tokens in `src/styles/base.css`; storefront `store.css`, admin `admin.css`. Display font Big Shoulders Display, body Hanken Grotesk, mono IBM Plex Mono. Accent is verdigris `--verdigris`.
- Payments: PayU is the preferred online gateway (`src/lib/payu.ts` hash + postservice client, `payu-orders.ts` start/confirm; return `src/app/api/payments/payu/return` (POST from PayU, then GET to clear the bag), webhook `.../payu/webhook`; browser helper `payu-client.ts` posts the signed form). A PayU order is marked paid only after `verify_payment` says success for the exact total. txnid = order number, then `-R2`, `-R3` on retries. `onlineGateway()` in `src/lib/online.ts` picks PayU, then Cashfree, then Razorpay.
- Cashfree is the second online gateway (`src/lib/cashfree.ts` REST client + webhook signature, `cashfree-orders.ts` start/confirm; return `src/app/api/payments/cashfree/return`, webhook `.../cashfree/webhook`; browser helper `cashfree-client.ts`). A Cashfree order is marked paid only after `GET /pg/orders/{id}` says PAID for the exact total. `src/lib/online.ts` picks the gateway. Also Razorpay (`src/lib/razorpay.ts`), COD, and direct UPI via a self-hosted YouPI gateway (`src/lib/youpi.ts` client + signature check, `youpi-start.ts` opens a session, `youpi-orders.ts` applies outcomes; webhook `src/app/api/payments/youpi`). UPI orders sit at payment status VERIFYING until staff confirm in the admin; only a RECONCILED event marks them paid automatically.
- Shipping: Shiprocket (`src/lib/shiprocket.ts` API client with cached token, `shiprocket-orders.ts` ship/book/track/cancel + status mapping; webhook `src/app/api/logistics/tracking`, path must avoid "sr"/"kr"). Placed orders are handed over from `sendPlacedEmails` via `after()`.
- Speed: storefront pages (home, shop, product, FAQ, size guide, content pages) are cached (ISR, `revalidate = 60`), so they must not read cookies on the server. Per-visitor data (bag, signed-in, wishlist, live stock) loads in the browser via `fetchSession()` / `productLive()` in `src/app/(store)/actions.ts`. Every admin `run()` action calls `revalidatePath("/", "layout")`. Functions run in `sin1` (vercel.json) next to the Neon database. Shop filters/sort/search run in the browser (`shop/ShopView.tsx`, data from `listShopProducts()`). CSS is inlined (`experimental.inlineCss`). Avoid read/write layout interleaving in effects (see `Lift.tsx`).
- Security: `rateLimit()` is async and Postgres-backed (`src/lib/rate-limit.ts`); signing secret via `authSecret()` (`src/lib/secret.ts`); redirects through `safeNext()`; CSV cells through `csvCell()`.
- Health checks: `src/lib/health/` (live.ts, audit.ts, pagespeed.ts). Background jobs: `src/lib/scheduler.ts` started from `src/instrumentation-node.ts`.
