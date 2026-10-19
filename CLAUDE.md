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
- Health checks: `src/lib/health/` (live.ts, audit.ts, pagespeed.ts). Background jobs: `src/lib/scheduler.ts` started from `src/instrumentation-node.ts`.
