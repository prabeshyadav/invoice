import importlib
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.apps import apps as django_apps
from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.template.loader import render_to_string
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
        # New invoices have no discount or tax unless set.
        self.assertEqual(res.data['sub_total'], '100.00')
        self.assertEqual(res.data['discount_amount'], '0.00')
        self.assertEqual(res.data['tax_amount'], '0.00')
        self.assertEqual(res.data['total'], '100.00')
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
        self.assertEqual(res.data['results'][0]['sub_total'], '50.00')


class MoneyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user('u', password='pass12345'))
        self.customer = make_customer()

    def _create(self, **extra):
        payload = {
            'customer_name': self.customer.id, 'invoice_date': '2026-01-01',
            'due_date': '2026-01-31', 'subject': 'Work',
            'line_items': [
                {'items_details': 'Consulting', 'quantity': '1.5', 'rate': '10.25'},
                {'items_details': 'Design', 'quantity': '3', 'rate': '33.33'},
            ],
            **extra,
        }
        return self.client.post('/api/invoices/', payload, format='json')

    def test_decimal_line_items_round_half_up(self):
        res = self._create()
        self.assertEqual(res.status_code, 201, res.data)
        amounts = [line['amount'] for line in res.data['line_items']]
        self.assertEqual(amounts, ['15.38', '99.99'])  # 1.5 x 10.25 = 15.375
        self.assertEqual(res.data['line_items'][0]['quantity'], '1.50')
        self.assertEqual(res.data['sub_total'], '115.37')

    def test_discount_then_tax(self):
        res = self._create(discount_percent='12.5', tax_percent='13')
        self.assertEqual(res.status_code, 201, res.data)
        # 115.37 - 14.42 (12.5%, from 14.42125) = 100.95; 13% tax = 13.12 (from 13.1235)
        self.assertEqual(res.data['discount_amount'], '14.42')
        self.assertEqual(res.data['discounted_total_amount'], '100.95')
        self.assertEqual(res.data['tax_amount'], '13.12')
        self.assertEqual(res.data['total'], '114.07')

    def test_percent_must_be_between_0_and_100(self):
        res = self._create(discount_percent='150')
        self.assertEqual(res.status_code, 400)
        self.assertIn('discount_percent', res.data)

    def test_catalog_item_decimal_price_and_tax_rate(self):
        res = self.client.post('/api/items/', {
            'type': 'Services', 'name': 'Hour', 'description': 'Hourly work',
            'selling_price': '2500.50', 'tax_rate': '13', 'unit': 'hour',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['selling_price'], res.data['tax_rate']), ('2500.50', '13.00'))

    def test_migration_keeps_legacy_10_percent_discount(self):
        migration = importlib.import_module('management.migrations.0022_decimal_money_tax_discount')
        invoice = make_invoice(self.customer, 'KIT-101')
        migration.keep_legacy_discount(django_apps, None)
        invoice.refresh_from_db()
        self.assertEqual(invoice.discount_percent, Decimal('10'))
        self.assertEqual(invoice.total, Decimal('90.00'))

    def test_pdf_and_reminder_templates_show_tax_and_total(self):
        invoice = make_invoice(self.customer, 'KIT-101')  # 2 x 50
        invoice.discount_percent, invoice.tax_percent = Decimal('10'), Decimal('13')
        invoice.save()
        pdf_html = render_to_string('invoice_pdf.html', {
            'invoice_object': invoice, 'invoice_items': invoice.tableitems_set.all(),
        })
        # 100 - 10 = 90; 13% tax = 11.70; total 101.70
        self.assertIn('Discount (10%)', pdf_html)
        self.assertIn('Tax (13%)', pdf_html)
        self.assertIn('11.70', pdf_html)
        self.assertIn('NPR 101.70', pdf_html)
        email_html = render_to_string('email_templates/due_date_email.html', {
            'invoice': invoice, 'customer': self.customer,
        })
        self.assertIn('101.70', email_html)


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
