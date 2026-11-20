from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.module_loading import import_string
from rest_framework.test import APIClient

from . import tasks
from .models import AddCustomer, Invoice, TableItems


def make_customer(n=1):
    return AddCustomer.objects.create(
        primary_contact='Mr.', first_name=f'First{n}', last_name='Last',
        customer_display_name=f'Customer {n}', currency='AUD',
        email=f'c{n}@example.com', phone='123', mobile='456',
    )


def make_invoice(customer, number, items=((2, 50),)):
    invoice = Invoice.objects.create(
        customer_name=customer, invoice_number=number,
        invoice_date=date(2026, 1, 1), due_date=date(2026, 1, 31), subject='Work',
    )
    for qty, rate in items:
        TableItems.objects.create(invoice=invoice, items_details='x', quantity=qty, rate=rate)
    return invoice


class InvoiceApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user('u', password='pass12345'))

    def test_requires_auth(self):
        self.assertEqual(APIClient().get('/api/invoices/').status_code, 401)

    def test_create_auto_numbers_and_totals(self):
        customer = make_customer()
        res = self.client.post('/api/invoices/', {
            'customer_name': customer.id, 'invoice_date': '2026-01-01',
            'due_date': '2026-01-31', 'subject': 'Work', 'status': 'draft',
            'line_items': [{'items_details': 'Design', 'quantity': 2, 'rate': 50}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['invoice_number'], 'KIT-101')
        self.assertEqual(res.data['sub_total'], 100)
        self.assertEqual(res.data['discounted_total_amount'], 90)
        self.assertEqual(res.data['customer_display_name'], 'Customer 1')

    def test_filter_by_customer(self):
        a, b = make_customer(1), make_customer(2)
        make_invoice(a, 'KIT-101')
        make_invoice(b, 'KIT-102')
        res = self.client.get(f'/api/invoices/?customer={a.id}')
        self.assertEqual([i['invoice_number'] for i in res.data['results']], ['KIT-101'])

    def test_list_query_count_is_constant(self):
        customer = make_customer()
        for n in range(10):
            make_invoice(customer, f'KIT-{101 + n}', items=((1, 10), (2, 20)))
        # auth user is forced, so: count + invoices + prefetched line items.
        with self.assertNumQueries(3):
            res = self.client.get('/api/invoices/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['results'][0]['sub_total'], 50)


class DueDateReminderTests(TestCase):
    def setUp(self):
        self.customer = make_customer()
        self.today = date(2026, 11, 20)

    def _due_in(self, days, number, status='sent'):
        invoice = make_invoice(self.customer, number)
        invoice.due_date = self.today + timedelta(days=days)
        invoice.status = status
        invoice.save()
        return invoice

    @override_settings(REMINDER_DAYS_BEFORE_DUE=3)
    def test_queues_only_unpaid_invoices_due_in_reminder_window(self):
        target = self._due_in(3, 'KIT-101')
        self._due_in(3, 'KIT-102', status='paid')
        self._due_in(4, 'KIT-103')
        self._due_in(-1, 'KIT-104')
        with patch('management.tasks.timezone.localdate', return_value=self.today), \
                patch('management.tasks.send_due_date_email.delay') as delay:
            # Beat calls it with no arguments.
            queued = tasks.send_due_date_reminders()
        delay.assert_called_once_with(target.id)
        self.assertEqual(queued, 1)

    def test_sends_html_email_with_pdf_to_customer(self):
        invoice = self._due_in(3, 'KIT-101')
        tasks.send_due_date_email(invoice.id)
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertEqual(msg.to, ['c1@example.com'])
        self.assertIn('KIT-101', msg.subject)
        self.assertIn('KIT-101', msg.alternatives[0][0])
        self.assertEqual(msg.attachments[0][0], 'invoice-KIT-101.pdf')
        self.assertEqual(msg.attachments[0][2], 'application/pdf')

    def test_skips_paid_and_missing_invoices(self):
        paid = self._due_in(3, 'KIT-101', status='paid')
        tasks.send_due_date_email(paid.id)
        tasks.send_due_date_email(999999)
        self.assertEqual(mail.outbox, [])

    def test_beat_schedule_points_at_registered_tasks(self):
        for entry in settings.CELERY_BEAT_SCHEDULE.values():
            self.assertTrue(callable(import_string(entry['task'])), entry['task'])


# Imported here (not at the top) to keep this block self-contained for merges.
from django.core.cache import cache  # noqa: E402
from django.core.exceptions import ImproperlyConfigured  # noqa: E402
from rest_framework.throttling import SimpleRateThrottle  # noqa: E402

from invoice.env import resolve_secret_key  # noqa: E402


class ProductionReadinessTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_health_is_public_and_reports_ok(self):
        res = APIClient().get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {'status': 'ok'})

    def test_login_is_throttled(self):
        User.objects.create_user('u', password='pass12345')
        client = APIClient()
        body = {'username': 'u', 'password': 'wrong-password'}
        # THROTTLE_RATES is read once at import; patch the shared dict.
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'auth': '2/min'}):
            codes = [client.post('/api/auth/token/', body, format='json').status_code for _ in range(3)]
        self.assertEqual(codes, [401, 401, 429])

    def test_register_is_throttled(self):
        client = APIClient()
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'auth': '1/min'}):
            first = client.post('/api/auth/register/', {
                'username': 'new', 'email': 'n@example.com', 'password': 'pass12345',
            }, format='json')
            second = client.post('/api/auth/register/', {
                'username': 'new2', 'email': 'n2@example.com', 'password': 'pass12345',
            }, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 429)

    def test_secret_key_guard(self):
        with self.assertRaises(ImproperlyConfigured):
            resolve_secret_key('', debug=False)
        with self.assertRaises(ImproperlyConfigured):
            resolve_secret_key('django-insecure-abc', debug=False)
        self.assertEqual(resolve_secret_key('s3cret-value', debug=False), 's3cret-value')
        self.assertTrue(resolve_secret_key('', debug=True).startswith('django-insecure'))
