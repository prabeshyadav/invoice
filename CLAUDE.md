# CLAUDE.md

Invoice management system: a Django REST API, a Next.js frontend, and Celery for scheduled emails.

## Run (Docker is the default)

```bash
docker compose up -d --build                         # all services
docker compose logs -f backend frontend              # logs
docker compose run --rm --no-deps backend python manage.py test management   # backend tests
docker compose up -d --build frontend                # rebuild the UI after frontend changes
```

- Frontend: http://127.0.0.1:3000. Backend: http://127.0.0.1:8002 on the host (`backend:8000` inside compose).
- `.env` is optional because `invoice/settings.py` has dev defaults. Copy `.env.example` to set SMTP. Without it, emailing an invoice fails.
- The backend mounts the repo, so Python changes hot-reload. The frontend is a production image, so rebuild it to see UI changes.
- Migrations run on backend start. The SQLite DB is `./db.sqlite3`.
- Settings default to **production**: `DEBUG` is off and a real `SECRET_KEY` is required (`invoice/env.py::resolve_secret_key`). The dev compose sets `DEBUG=True`; running `manage.py` outside it needs `DEBUG=True` too.
- Production: `docker compose -f docker-compose.prod.yml up -d --build` (Postgres, gunicorn, WhiteNoise, Redis cache). Required `.env` variables are listed in README → "Production deployment". Health check: `GET /api/health/`.
- Login and register are rate-limited (`throttle_scope = 'auth'`, `management/auth_views.py`). Tests that hit them repeatedly should `cache.clear()` in `setUp`.
- Accounts: with `EMAIL_VERIFICATION_REQUIRED` (default on) new users are inactive until they open the emailed `/verify-email` link. Password reset emails a `/reset-password` link. Links use `FRONTEND_URL`. Logic is in `management/account.py`; views in `auth_views.py`. Dev compose prints emails to `docker compose logs backend` (console backend) unless `EMAIL_BACKEND` is set. Request endpoints (reset, resend) always return the same response so they can't be used to discover accounts.

Frontend checks (run from `frontend/`): `npm ci`, then `./node_modules/.bin/eslint lib components app` and `npm run build`.

## Layout

| Path | What |
|---|---|
| `invoice/` | Django project: settings, root urls, Celery app, choice constants (`commons.py`) |
| `management/models.py` | `AddCustomer`, `Invoice`, `TableItems` (line items), `Items` (catalog) |
| `management/api.py`, `serializers.py` | DRF viewsets under `/api/` (JWT). Used by the frontend. |
| `management/pdf.py`, `templates/` | `render_to_pdf` plus the PDF (`invoice_pdf.html`) and email templates. The legacy HTML views were removed; only `/api/*` and `/admin/` are served. |
| `management/tests.py` | API tests, including a query-count test for the invoice list |
| `frontend/lib/api.ts` | Typed API client (same-origin, cookie-authenticated), formatting helpers |
| `frontend/lib/auth.tsx` | `AuthProvider` (bootstraps from `GET /api/session`), `useAuth`, `RequireAuth` |
| `frontend/lib/session.ts` | Server-only: session cookies, CSRF same-origin check, token refresh |
| `frontend/app/api/session/` | `GET` session state, `POST login` / `POST logout`. These set and clear the httpOnly JWT cookies |
| `frontend/components/ui.tsx` | Design system: class tokens (`btnPrimary`, `inputCls`, `card`, …) and components (`Card`, `PageHeader`, `StatusBadge`, …) |
| `frontend/app/api/[...slug]/route.ts` | Proxies `/api/*` to Django (`API_URL`), so there is no CORS. Adds `Authorization` from the `access` cookie and refreshes once on 401 |

## Conventions

- **Frontend:** Next.js 16 with breaking changes. Read `frontend/AGENTS.md` and `node_modules/next/dist/docs/` before using a Next API you have not checked. Pages are client components wrapped in `<RequireAuth>`. Reuse the tokens and components in `components/ui.tsx` instead of hand-writing Tailwind colours. Theme colours live in `app/globals.css` under `@theme`.
- **Icons:** Material Symbols, self-hosted at `public/fonts/`. Use `<Icon name="…" />`.
- **API:** Django needs trailing slashes, and the proxy adds them. Lists are paginated (20 per page), so call `listAll()` to fetch every page. `GET /api/invoices/?customer=<id>` filters by customer.
- **Dashboard:** `GET /api/dashboard/` returns counts, totals (billed, collected, outstanding, overdue), `by_status`, the 6 most recent and 5 upcoming invoices in 3 queries. The dashboard page uses it instead of downloading every invoice. Totals reuse `Invoice.total`, so they match the invoice pages to the cent.
- **Slow work goes to Celery:** `POST /api/invoices/{id}/send_email/` validates, queues `send_invoice_email` and returns 202. SMTP failures surface in the worker log (with retries), not in the response.
- **Auth (security-critical):** JWTs never reach browser JavaScript. `POST /api/session/login` stores `access`, `refresh` and `username` as httpOnly, `SameSite=Lax` cookies. They are Secure behind https (`x-forwarded-proto`) or when `COOKIE_SECURE=true`. The proxy ignores any client `Authorization` header and refuses to proxy `auth/token` and `auth/token/refresh`. Non-GET requests to `/api/*` must be same-origin (Origin, falling back to Referer, compared to `x-forwarded-host` or `host`); otherwise they get 403. Do not store tokens in `localStorage`.
- **Tenancy (security-critical):** `AddCustomer`, `Invoice` and `Items` have a required `owner`; line items are owned through their invoice. Every viewset must use `OwnedViewSetMixin` (`management/api.py`), which filters by `request.user` and sets the owner on create. Related fields that point at owned objects use `OwnedPrimaryKeyRelatedField`. Uniqueness (customer email, invoice number) is per owner. Every new endpoint needs a test proving another user gets 404.
- **Backend:** keep list endpoints free of N+1 queries. Model properties must use `self.tableitems_set.all()` so that `prefetch_related` applies. Every list endpoint you add or change needs an `assertNumQueries` test.

## Domain gotchas

- Money is `DecimalField` (2 places), and the API returns it as strings such as `"12.50"`. Round with `money()` in `management/models.py` (cents, half up). Never use floats for money.
- Each invoice has its own `discount_percent` and `tax_percent` (0–100, default 0). Totals: `sub_total` → minus `discount_amount` = `discounted_total_amount` (taxable) → plus `tax_amount` = `total`. Show `total` as the amount due. The live preview in `components/InvoiceForm.tsx` mirrors this order and rounding, so change both together. Migration 0025 set `discount_percent=10` on invoices created before it, to keep their old hard-coded discount.
- Invoice numbers are generated per owner as `KIT-<highest numeric suffix + 1>`, starting at `KIT-101` (`management/utils.py`), when none is given. Hand-entered numbers that aren't `KIT-<digits>` are ignored. Generation locks the owner's user row inside the create transaction, and a duplicate that still slips through returns 400 on `invoice_number`, never 500.
- "Overdue" is not stored. It is derived when status ≠ `paid` and the due date is before today: on the frontend by `displayStatus`, and in the dashboard endpoint by `display_status` in `management/api.py` (today in `TIME_ZONE`). Keep the two in sync. The stored statuses are `draft`, `sent` and `paid`.
- Choice values (currencies, salutations and so on) are duplicated in `invoice/commons.py` and `frontend/lib/api.ts`. Keep them in sync.

- Due-date reminders: beat runs `send_due_date_reminders` daily at 08:00 (`CELERY_TIMEZONE`). It queues `send_due_date_email` for each unpaid invoice due in exactly `REMINDER_DAYS_BEFORE_DUE` days (default 3). The exact-date match is what prevents duplicate emails, so keep the schedule at once a day.

## Notes

- Root `.gitignore` entries are Python-template rules. `lib/` is root-anchored (`/lib/`) on purpose: unanchored, it ignored `frontend/lib/`.
