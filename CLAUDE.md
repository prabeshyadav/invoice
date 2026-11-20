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

Frontend checks (run from `frontend/`): `npm ci`, then `./node_modules/.bin/eslint lib components app` and `npm run build`.

## Layout

| Path | What |
|---|---|
| `invoice/` | Django project: settings, root urls, Celery app, choice constants (`commons.py`) |
| `management/models.py` | `AddCustomer`, `Invoice`, `TableItems` (line items), `Items` (catalog) |
| `management/api.py`, `serializers.py` | DRF viewsets under `/api/` (JWT). Used by the frontend. |
| `management/views.py`, `templates/` | Legacy server-rendered HTML pages. `invoice_pdf.html` is also used for the PDF. |
| `management/tests.py` | API tests, including a query-count test for the invoice list |
| `frontend/lib/api.ts` | Typed API client, token storage, refresh-on-401, formatting helpers |
| `frontend/lib/auth.tsx` | `AuthProvider`, `useAuth`, `RequireAuth` |
| `frontend/components/ui.tsx` | Design system: class tokens (`btnPrimary`, `inputCls`, `card`, …) and components (`Card`, `PageHeader`, `StatusBadge`, …) |
| `frontend/app/api/[...slug]/route.ts` | Proxies `/api/*` to Django (`API_URL`), so there is no CORS |

## Conventions

- **Frontend:** Next.js 16 with breaking changes. Read `frontend/AGENTS.md` and `node_modules/next/dist/docs/` before using a Next API you have not checked. Pages are client components wrapped in `<RequireAuth>`. Reuse the tokens and components in `components/ui.tsx` instead of hand-writing Tailwind colours. Theme colours live in `app/globals.css` under `@theme`.
- **Icons:** Material Symbols, self-hosted at `public/fonts/`. Use `<Icon name="…" />`.
- **API:** Django needs trailing slashes, and the proxy adds them. Lists are paginated (20 per page), so call `listAll()` to fetch every page. `GET /api/invoices/?customer=<id>` filters by customer.
- **Backend:** keep list endpoints free of N+1 queries. Model properties must use `self.tableitems_set.all()` so that `prefetch_related` applies. Every list endpoint you add or change needs an `assertNumQueries` test.

## Domain gotchas

- The discount is a hard-coded 10% in `Invoice.discounted_total_amount`. The frontend mirrors it as `DISCOUNT_PERCENT` in `lib/api.ts`, so change both together.
- Invoice numbers are generated as `KIT-101`, `KIT-102`, … (`management/utils.py`) when none is given.
- "Overdue" is not stored. It is derived on the frontend (`displayStatus`) when status ≠ `paid` and the due date is past. The stored statuses are `draft`, `sent` and `paid`.
- Choice values (currencies, salutations and so on) are duplicated in `invoice/commons.py` and `frontend/lib/api.ts`. Keep them in sync.

- Due-date reminders: beat runs `send_due_date_reminders` daily at 08:00 (`CELERY_TIMEZONE`). It queues `send_due_date_email` for each unpaid invoice due in exactly `REMINDER_DAYS_BEFORE_DUE` days (default 3). The exact-date match is what prevents duplicate emails, so keep the schedule at once a day.

## Notes

- Root `.gitignore` entries are Python-template rules. `lib/` is root-anchored (`/lib/`) on purpose: unanchored, it ignored `frontend/lib/`.
