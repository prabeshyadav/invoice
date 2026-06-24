# Invoice Management System

A Django web application for managing customers and invoices: create customers, build line-itemed invoices, view/edit them, export invoices as PDF, and email PDF invoices and due-date reminders to customers. Scheduled reminders are sent via Celery + Celery Beat with Redis as the broker.

## Features

- **Customer management** — add, edit, view, and delete customers (`AddCustomer`), with business/individual type, currency, salutation, and contact details.
- **Invoice management** — create invoices tied to a customer (`Invoice`), with auto-incrementing invoice numbers (`KIT-101`, `KIT-102`, ...), line items (`TableItems`), subtotal/discount calculation, and status (`draft`, `sent`, `paid`).
- **PDF export** — render any invoice to PDF on demand using `xhtml2pdf`.
- **Email** — send invoice PDFs and due-date reminder emails to customers via Django's SMTP email backend.
- **Scheduled reminders** — a Celery Beat schedule runs `send_due_date_email` periodically to notify customers of upcoming due dates.
- **Auth** — registration, login, logout, and password reset pages backed by Django's auth system.
- **Admin** — Django admin is enabled for `AddCustomer`, `Invoice`, and `TableItems`.

## Tech Stack

- **Backend:** Django 6.0
- **Task queue:** Celery 5.6 with Redis as the broker, Celery Beat for scheduling
- **PDF generation:** xhtml2pdf
- **Database:** SQLite (default, via `db.sqlite3`)
- **Frontend:** Django templates + Bootstrap

## Project Structure

```
invoice/            # Django project: settings, URLs, Celery app, shared choices (commons.py)
management/          # Main app: models, views, forms, URLs, Celery tasks, admin
  migrations/        # Database migrations
templates/           # HTML templates (auth, customers, invoices, PDF, email)
static/              # CSS, JS, and images
manage.py            # Django management entry point
requirements.txt     # Python dependencies
```

### Key models (`management/models.py`)

| Model | Purpose |
|---|---|
| `AddCustomer` | Customer profile: type, contact, currency, social links |
| `Invoice` | Invoice header: customer, invoice number, dates, subject, status |
| `Items` | Reusable catalog item (goods/services, price, tax, unit) |
| `TableItems` | Line item on an invoice (details, quantity, rate, computed amount) |

## Prerequisites

- Python 3.13+
- Redis (required for Celery broker/scheduled emails)
- An SMTP account for sending email (Gmail SMTP is configured by default)

## Setup

1. **Clone and create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure secrets**

   `invoice/settings.py` currently has `SECRET_KEY`, `EMAIL_HOST_USER`, and `EMAIL_HOST_PASSWORD` hardcoded. Before running this anywhere beyond local experimentation, move these to environment variables (e.g. via `os.environ` or `python-decouple`) and **rotate the credentials currently committed to the repo**.

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create a superuser** (for `/admin/`)
   ```bash
   python manage.py createsuperuser
   ```

6. **Start Redis** (required for Celery)
   ```bash
   redis-server
   ```

7. **Run the development server**
   ```bash
   python manage.py runserver
   ```

8. **Run Celery worker and beat scheduler** (in separate terminals, for emailed reminders)
   ```bash
   celery -A invoice worker -l info
   celery -A invoice beat -l info
   ```

## URLs

| Path | View | Description |
|---|---|---|
| `/` | `Customer` | Add customer / customer list landing page |
| `/login/` | `loginPage` | Login |
| `/logout/` | `logoutUser` | Logout |
| `/register` | `register` | Create a new user account |
| `/reset` | `ResetPassword` | Password reset page |
| `/table` | `tableView` | List of customers |
| `/delete/<id>/` | `DeleteCustomer` | Delete a customer |
| `/customerview/<id>/` | `CustomerViewPage` | Customer detail with their invoices and total |
| `/editcustomer/<id>` | `EditCustomer` | Edit a customer |
| `/invoice/` | `InvoiceView` | Create an invoice with line items |
| `/invoicelist` | `InvoiceListView` | List of all invoices |
| `/invoice-detail/<id>/` | `IndexView` | Invoice detail view |
| `/edit/<id>/` | `EditView` | Edit an invoice |
| `/pdf/<id>/` | `pdf` | Download invoice as PDF |
| `/items/` | `ItemView` | Items page |
| `/email` | `email` | Email page |
| `/admin/` | Django admin | Manage data via Django admin |

## Notes

- `requirements.txt` pins `Django==6.0.6`, but the codebase (`invoice/settings.py`) is annotated as generated for Django 4.1 — confirm compatibility before deploying.
- `DEBUG = True` and `ALLOWED_HOSTS = []` in `invoice/settings.py` are development defaults and must be changed for any non-local deployment.
