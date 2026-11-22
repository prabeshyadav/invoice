import importlib
import re
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.apps import apps as django_apps
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.utils.module_loading import import_string
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from invoice.env import resolve_secret_key

from . import tasks
from .account import email_verification_token
from .models import AddCustomer, Invoice, InvoiceActivity, Items, TableItems, OrganizationProfile, Payment
from .utils import new_invoice_number


def default_owner():
    return User.objects.get_or_create(username='owner')[0]


def make_customer(n=1, owner=None):
    return AddCustomer.objects.create(
        owner=owner or default_owner(),
        primary_contact='Mr.', first_name=f'First{n}', last_name='Last',
        customer_display_name=f'Customer {n}', currency='AUD',
        email=f'c{n}@example.com', phone='123', mobile='456',
    )


def make_invoice(customer, number, items=((2, 50),)):
    invoice = Invoice.objects.create(
        owner=customer.owner, customer_name=customer, invoice_number=number,
        invoice_date=date(2026, 1, 1), due_date=date(2026, 1, 31), subject='Work',
    )
    for qty, rate in items:
        TableItems.objects.create(invoice=invoice, items_details='x', quantity=qty, rate=rate)
    return invoice


class InvoiceApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(default_owner())

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
        # auth user is forced, so: count + invoices + prefetched line items + prefetched payments + prefetched activities.
        with self.assertNumQueries(5):
            res = self.client.get('/api/invoices/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['results'][0]['sub_total'], '50.00')


class MoneyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(default_owner())
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
        migration = importlib.import_module('management.migrations.0025_decimal_money_tax_discount')
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


class OwnerIsolationTests(TestCase):
    """User B must never see or touch user A's data."""

    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.bob = User.objects.create_user('bob')
        self.customer = make_customer(1, owner=self.alice)
        self.invoice = make_invoice(self.customer, 'KIT-101')
        self.line_item = self.invoice.tableitems_set.get()
        self.item = Items.objects.create(
            owner=self.alice, type='Goods', name='Widget', description='d',
            selling_price=10, tax_rate=0, unit='pcs',
        )
        self.as_alice = APIClient()
        self.as_alice.force_authenticate(self.alice)
        self.as_bob = APIClient()
        self.as_bob.force_authenticate(self.bob)

    def _invoice_payload(self, customer, **extra):
        return {
            'customer_name': customer.id, 'invoice_date': '2026-01-01',
            'due_date': '2026-01-31', 'subject': 'x', **extra,
        }

    def _detail_urls(self):
        return {
            '/api/customers/': self.customer.id,
            '/api/invoices/': self.invoice.id,
            '/api/items/': self.item.id,
            '/api/line-items/': self.line_item.id,
        }

    def test_lists_only_show_own_data(self):
        for url in self._detail_urls():
            self.assertEqual(self.as_bob.get(url).data['count'], 0, url)
            self.assertEqual(self.as_alice.get(url).data['count'], 1, url)

    def test_other_users_objects_return_404(self):
        for url, pk in self._detail_urls().items():
            detail = f'{url}{pk}/'
            self.assertEqual(self.as_bob.get(detail).status_code, 404, detail)
            self.assertEqual(self.as_bob.patch(detail, {}, format='json').status_code, 404, detail)
            self.assertEqual(self.as_bob.delete(detail).status_code, 404, detail)
        self.assertEqual(self.as_bob.get(f'/api/invoices/{self.invoice.id}/pdf/').status_code, 404)
        self.assertEqual(self.as_bob.post(f'/api/invoices/{self.invoice.id}/send_email/').status_code, 404)
        self.assertTrue(AddCustomer.objects.filter(pk=self.customer.pk).exists())
        self.assertTrue(TableItems.objects.filter(pk=self.line_item.pk).exists())

    def test_create_assigns_owner_and_ignores_client_owner(self):
        res = self.as_bob.post('/api/items/', {
            'type': 'Goods', 'name': 'Bolt', 'description': 'd',
            'selling_price': 1, 'tax_rate': 0, 'unit': 'pcs', 'owner': self.alice.id,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertNotIn('owner', res.data)
        self.assertEqual(Items.objects.get(pk=res.data['id']).owner, self.bob)

    def test_cannot_invoice_another_users_customer(self):
        res = self.as_bob.post('/api/invoices/', self._invoice_payload(self.customer), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('customer_name', res.data)

    def test_cannot_move_line_item_to_another_users_invoice(self):
        res = self.as_bob.post('/api/line-items/', {
            'invoice': self.invoice.id, 'items_details': 'x', 'quantity': 1, 'rate': 1,
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('invoice', res.data)

    def test_invoice_numbers_are_per_owner(self):
        bob_customer = make_customer(1, owner=self.bob)
        res = self.as_bob.post('/api/invoices/', self._invoice_payload(bob_customer), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['invoice_number'], 'KIT-101')
        res = self.as_alice.post('/api/invoices/', self._invoice_payload(self.customer), format='json')
        self.assertEqual(res.data['invoice_number'], 'KIT-102')

    def test_duplicate_invoice_number_for_same_owner_is_400(self):
        res = self.as_alice.post(
            '/api/invoices/', self._invoice_payload(self.customer, invoice_number='KIT-101'), format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('invoice_number', res.data)

    def test_same_customer_email_allowed_for_different_owners_only(self):
        payload = {
            'primary_contact': 'Mr.', 'first_name': 'A', 'last_name': 'B',
            'customer_display_name': 'AB', 'currency': 'AUD', 'phone': '1',
            'mobile': '2', 'email': self.customer.email,
        }
        self.assertEqual(self.as_bob.post('/api/customers/', payload, format='json').status_code, 201)
        res = self.as_alice.post('/api/customers/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)

    def test_customer_creation_allows_blank_phone(self):
        payload = {
            'primary_contact': 'Mr.', 'first_name': 'Jane', 'last_name': 'Doe',
            'customer_display_name': 'Jane Doe', 'currency': 'AUD', 'phone': '',
            'mobile': '9800000000', 'email': 'jane@example.com',
        }
        res = self.as_bob.post('/api/customers/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['phone'], '')


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


class InvoiceNumberingTests(TestCase):
    def setUp(self):
        self.owner = default_owner()
        self.customer = make_customer(owner=self.owner)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def _post(self, **extra):
        return self.client.post('/api/invoices/', {
            'customer_name': self.customer.id, 'invoice_date': '2026-01-01',
            'due_date': '2026-01-31', 'subject': 'Work', **extra,
        }, format='json')

    def test_starts_at_kit_101(self):
        self.assertEqual(new_invoice_number(self.owner), 'KIT-101')

    def test_uses_highest_suffix_not_latest_row(self):
        make_invoice(self.customer, 'KIT-150')
        make_invoice(self.customer, 'KIT-99')      # created later, lower number
        make_invoice(self.customer, 'INV-2026-7')  # manual, non-KIT
        make_invoice(self.customer, 'KIT-abc')     # manual, non-numeric suffix
        self.assertEqual(new_invoice_number(self.owner), 'KIT-151')

    def test_numeric_not_string_ordering(self):
        make_invoice(self.customer, 'KIT-999')
        make_invoice(self.customer, 'KIT-1000')
        # String ordering would pick KIT-999; numeric ordering must not.
        self.assertEqual(new_invoice_number(self.owner), 'KIT-1001')

    def test_sequential_api_creates_are_per_owner(self):
        numbers = [self._post().data['invoice_number'] for _ in range(3)]
        self.assertEqual(numbers, ['KIT-101', 'KIT-102', 'KIT-103'])
        other = User.objects.create_user('other')
        make_customer(9, owner=other)
        self.assertEqual(new_invoice_number(other), 'KIT-101')

    def test_integrity_error_on_create_is_a_400(self):
        with patch('management.serializers.Invoice.objects.create', side_effect=IntegrityError('dup')):
            res = self._post()
        self.assertEqual(res.status_code, 400)
        self.assertIn('invoice_number', res.data)


class SendInvoiceEmailTests(TestCase):
    def setUp(self):
        self.owner = default_owner()
        self.invoice = make_invoice(make_customer(owner=self.owner), 'KIT-101')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_endpoint_queues_task_and_returns_202(self):
        with patch('management.api.send_invoice_email.delay') as delay:
            res = self.client.post(
                f'/api/invoices/{self.invoice.id}/send_email/',
                {'to': 'boss@example.com', 'subject': 'Hi', 'message': 'Pay'}, format='json',
            )
        self.assertEqual(res.status_code, 202)
        self.assertIn('boss@example.com', res.data['detail'])
        delay.assert_called_once_with(self.invoice.id, 'boss@example.com', 'Hi', 'Pay')

    def test_defaults_to_customer_email(self):
        with patch('management.api.send_invoice_email.delay') as delay:
            res = self.client.post(f'/api/invoices/{self.invoice.id}/send_email/', {}, format='json')
        self.assertEqual(res.status_code, 202)
        self.assertEqual(delay.call_args.args[1], 'c1@example.com')
        self.assertIn('KIT-101', delay.call_args.args[2])

    def test_invalid_address_is_400(self):
        with patch('management.api.send_invoice_email.delay') as delay:
            res = self.client.post(
                f'/api/invoices/{self.invoice.id}/send_email/', {'to': 'nope'}, format='json'
            )
        self.assertEqual(res.status_code, 400)
        delay.assert_not_called()

    def test_other_users_invoice_is_404(self):
        intruder = APIClient()
        intruder.force_authenticate(User.objects.create_user('intruder'))
        with patch('management.api.send_invoice_email.delay') as delay:
            res = intruder.post(f'/api/invoices/{self.invoice.id}/send_email/', {}, format='json')
        self.assertEqual(res.status_code, 404)
        delay.assert_not_called()

    def test_task_sends_email_with_pdf(self):
        tasks.send_invoice_email(self.invoice.id, 'boss@example.com', 'Hi', 'Pay')
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertEqual((msg.to, msg.subject, msg.body), (['boss@example.com'], 'Hi', 'Pay'))
        self.assertEqual(msg.attachments[0][0], 'invoice-KIT-101.pdf')
        self.assertEqual(msg.attachments[0][2], 'application/pdf')

    def test_task_ignores_deleted_invoice(self):
        tasks.send_invoice_email(999999, 'boss@example.com', 'Hi', 'Pay')
        self.assertEqual(mail.outbox, [])


DASHBOARD_TODAY = date(2026, 6, 15)


class DashboardTests(TestCase):
    def setUp(self):
        self.owner = default_owner()
        self.customer = make_customer(owner=self.owner)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def _invoice(self, number, status, due_in_days, items=((1, 100),), **extra):
        invoice = make_invoice(self.customer, number, items=items)
        invoice.status = status
        invoice.due_date = DASHBOARD_TODAY + timedelta(days=due_in_days)
        for key, value in extra.items():
            setattr(invoice, key, value)
        invoice.save()
        return invoice

    def _get(self):
        with patch('management.api.timezone.localdate', return_value=DASHBOARD_TODAY):
            return self.client.get('/api/dashboard/')

    def test_totals_by_status_match_invoice_totals(self):
        self._invoice('KIT-101', 'paid', -30, items=((2, 50),))    # 100.00
        self._invoice('KIT-102', 'sent', 10, items=((1, 200),))    # 200.00
        self._invoice('KIT-103', 'draft', 20, items=((1, 50),))    # 50.00
        self._invoice('KIT-104', 'sent', -1, items=((Decimal('1.5'), Decimal('10.25')),),
                      discount_percent=Decimal('10'), tax_percent=Decimal('13'))  # overdue
        self._invoice('KIT-105', 'sent', 0, items=((1, 10),))      # due today: not overdue
        overdue_total = Invoice.objects.get(invoice_number='KIT-104').total
        self.assertEqual(overdue_total, Decimal('15.64'))  # 15.38 - 1.54 = 13.84, + 13% tax 1.80

        res = self._get()
        self.assertEqual(res.status_code, 200)
        d = res.data
        self.assertEqual(d['invoice_count'], 5)
        self.assertEqual(d['customer_count'], 1)
        self.assertEqual(d['totals'], {
            'billed': '375.64', 'collected': '100.00',
            'outstanding': '275.64', 'overdue': '15.64',
        })
        self.assertEqual(d['by_status'], {
            'paid': {'count': 1, 'amount': '100.00'},
            'sent': {'count': 2, 'amount': '210.00'},
            'draft': {'count': 1, 'amount': '50.00'},
            'overdue': {'count': 1, 'amount': '15.64'},
        })
        self.assertEqual([i['invoice_number'] for i in d['recent']],
                         ['KIT-105', 'KIT-104', 'KIT-103', 'KIT-102', 'KIT-101'])
        self.assertEqual(d['recent'][1]['total'], '15.64')
        self.assertEqual(d['recent'][1]['customer_display_name'], 'Customer 1')
        # Unpaid and not overdue, soonest due first.
        self.assertEqual([i['invoice_number'] for i in d['upcoming']], ['KIT-105', 'KIT-102', 'KIT-103'])

    def test_only_counts_own_data(self):
        self._invoice('KIT-101', 'sent', 5)
        stranger = User.objects.create_user('stranger')
        make_invoice(make_customer(7, owner=stranger), 'KIT-101')
        d = self._get().data
        self.assertEqual((d['invoice_count'], d['customer_count']), (1, 1))
        self.assertEqual(d['totals']['billed'], '100.00')

    def test_empty(self):
        d = self._get().data
        self.assertEqual(d['invoice_count'], 0)
        self.assertEqual(d['totals']['billed'], '0.00')
        self.assertEqual((d['recent'], d['upcoming']), ([], []))

    def test_query_count_is_constant(self):
        for n in range(3):
            self._invoice(f'KIT-{101 + n}', 'sent', n, items=((1, 10), (2, 20)))
        with self.assertNumQueries(4):
            self._get()
        for n in range(3, 15):
            self._invoice(f'KIT-{101 + n}', 'sent', n, items=((1, 10), (2, 20)))
        with self.assertNumQueries(4):
            res = self._get()
        self.assertEqual(res.data['invoice_count'], 15)


@override_settings(FRONTEND_URL='http://app.test')
class AccountEmailTests(TestCase):
    PASSWORD = 'Str0ng-pass-2026'

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def _link_params(self, message):
        match = re.search(r'http://app\.test/[\w-]+\?uid=([\w-]+)&token=([\w-]+)', message.body)
        self.assertIsNotNone(match, message.body)
        return {'uid': match.group(1), 'token': match.group(2)}

    def _login(self, username, password):
        return self.client.post('/api/auth/token/', {'username': username, 'password': password}, format='json')

    # Password reset

    def test_reset_request_is_generic_and_only_mails_existing_users(self):
        User.objects.create_user('alice', 'alice@example.com', self.PASSWORD)
        known = self.client.post('/api/auth/password-reset/', {'email': 'ALICE@example.com'}, format='json')
        unknown = self.client.post('/api/auth/password-reset/', {'email': 'nobody@example.com'}, format='json')
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['alice@example.com'])
        self.assertIn('http://app.test/reset-password?uid=', mail.outbox[0].body)
        self.assertIn('/reset-password?uid=', mail.outbox[0].alternatives[0][0])

    def test_reset_confirm_changes_password(self):
        User.objects.create_user('alice', 'alice@example.com', self.PASSWORD)
        self.client.post('/api/auth/password-reset/', {'email': 'alice@example.com'}, format='json')
        params = self._link_params(mail.outbox[0])
        res = self.client.post('/api/auth/password-reset/confirm/', {**params, 'new_password': 'An0ther-pass-2026'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self._login('alice', 'An0ther-pass-2026').status_code, 200)
        self.assertEqual(self._login('alice', self.PASSWORD).status_code, 401)
        # The token is single-use: the password hash changed.
        again = self.client.post('/api/auth/password-reset/confirm/', {**params, 'new_password': 'Th1rd-pass-2026'}, format='json')
        self.assertEqual(again.status_code, 400)

    def test_reset_confirm_rejects_bad_token_and_weak_password(self):
        user = User.objects.create_user('alice', 'alice@example.com', self.PASSWORD)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        bad = self.client.post('/api/auth/password-reset/confirm/', {'uid': uid, 'token': 'bad-token', 'new_password': 'An0ther-pass-2026'}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertIn('token', bad.data)
        garbage_uid = self.client.post('/api/auth/password-reset/confirm/', {'uid': '!!', 'token': 'x', 'new_password': 'An0ther-pass-2026'}, format='json')
        self.assertEqual(garbage_uid.status_code, 400)
        token = default_token_generator.make_token(user)
        weak = self.client.post('/api/auth/password-reset/confirm/', {'uid': uid, 'token': token, 'new_password': '12345'}, format='json')
        self.assertEqual(weak.status_code, 400)
        self.assertIn('new_password', weak.data)

    def test_verification_token_cannot_reset_password(self):
        user = User.objects.create_user('alice', 'alice@example.com', self.PASSWORD)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)
        res = self.client.post('/api/auth/password-reset/confirm/', {'uid': uid, 'token': token, 'new_password': 'An0ther-pass-2026'}, format='json')
        self.assertEqual(res.status_code, 400)

    # Email verification

    def _register(self, username='newbie', email='newbie@example.com'):
        return self.client.post('/api/auth/register/', {
            'username': username, 'email': email, 'password': self.PASSWORD,
        }, format='json')

    def test_register_requires_verification_before_login(self):
        res = self._register()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['verification_required'])
        self.assertNotIn('access', res.data)
        self.assertFalse(User.objects.get(username='newbie').is_active)
        self.assertEqual(mail.outbox[0].to, ['newbie@example.com'])

        login = self._login('newbie', self.PASSWORD)
        self.assertEqual(login.status_code, 401)
        self.assertEqual(str(login.data['detail']), 'Please verify your email before signing in.')
        # A wrong password must not reveal that the account exists but is unverified.
        wrong = self._login('newbie', 'not-the-password')
        self.assertNotEqual(str(wrong.data['detail']), 'Please verify your email before signing in.')

        verify = self.client.post('/api/auth/verify-email/', self._link_params(mail.outbox[0]), format='json')
        self.assertEqual(verify.status_code, 200, verify.data)
        self.assertTrue(User.objects.get(username='newbie').is_active)
        self.assertEqual(self._login('newbie', self.PASSWORD).status_code, 200)
        # The link stops working once used.
        reused = self.client.post('/api/auth/verify-email/', self._link_params(mail.outbox[0]), format='json')
        self.assertEqual(reused.status_code, 400)

    def test_register_requires_email_and_strong_password(self):
        no_email = self.client.post('/api/auth/register/', {'username': 'x', 'password': self.PASSWORD}, format='json')
        self.assertEqual(no_email.status_code, 400)
        self.assertIn('email', no_email.data)
        weak = self.client.post('/api/auth/register/', {'username': 'x', 'email': 'x@example.com', 'password': 'password'}, format='json')
        self.assertEqual(weak.status_code, 400)
        self.assertIn('password', weak.data)

    def test_verify_rejects_bad_token(self):
        self._register()
        user = User.objects.get(username='newbie')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        res = self.client.post('/api/auth/verify-email/', {'uid': uid, 'token': 'nope'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.get(username='newbie').is_active)

    def test_resend_is_generic_and_only_mails_unverified(self):
        self._register()
        User.objects.create_user('active', 'active@example.com', self.PASSWORD)
        mail.outbox.clear()
        responses = [
            self.client.post('/api/auth/verify-email/resend/', {'email': e}, format='json')
            for e in ('newbie@example.com', 'active@example.com', 'nobody@example.com')
        ]
        self.assertEqual({r.status_code for r in responses}, {200})
        self.assertEqual(len({str(r.data) for r in responses}), 1)
        self.assertEqual([m.to for m in mail.outbox], [['newbie@example.com']])
        verify = self.client.post('/api/auth/verify-email/', self._link_params(mail.outbox[0]), format='json')
        self.assertEqual(verify.status_code, 200)

    @override_settings(EMAIL_VERIFICATION_REQUIRED=False)
    def test_register_without_verification_is_active_immediately(self):
        res = self._register()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(res.data['verification_required'])
        self.assertTrue(User.objects.get(username='newbie').is_active)
        self.assertEqual(mail.outbox, [])
        self.assertEqual(self._login('newbie', self.PASSWORD).status_code, 200)


class CeleryWiringTests(TestCase):
    def test_tasks_queued_from_django_use_the_configured_broker(self):
        # Without invoice/__init__.py loading the Celery app, .delay() from a web
        # request falls back to Celery's default amqp://localhost and crashes.
        app = tasks.send_invoice_email.app
        self.assertEqual(app.main, 'invoice')
        self.assertEqual(app.conf.broker_url, settings.CELERY_BROKER_URL)


class ClientIdentityThrottleTests(TestCase):
    """Django sits behind the Next.js proxy, so REMOTE_ADDR is always the proxy.
    Limits must follow the real client (X-Forwarded-For) and the account."""

    def setUp(self):
        cache.clear()
        User.objects.create_user('alice', 'alice@example.com', 'Str0ng-pass-2026')
        User.objects.create_user('bob', 'bob@example.com', 'Str0ng-pass-2026')

    def tearDown(self):
        cache.clear()

    def _login(self, username, ip):
        return APIClient().post(
            '/api/auth/token/', {'username': username, 'password': 'wrong'},
            format='json', HTTP_X_FORWARDED_FOR=ip,
        ).status_code

    def test_clients_behind_the_proxy_have_separate_ip_limits(self):
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'auth': '2/min', 'auth_identifier': '100/min'}):
            first = [self._login('alice', '203.0.113.1') for _ in range(3)]
            other_client = self._login('bob', '203.0.113.2')
        self.assertEqual(first, [401, 401, 429])
        self.assertEqual(other_client, 401)

    def test_only_the_proxy_appended_address_is_trusted(self):
        # A client-supplied entry before the proxy's own must not change identity.
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'auth': '2/min', 'auth_identifier': '100/min'}):
            codes = [self._login('alice', f'10.0.0.{n}, 203.0.113.9') for n in range(3)]
        self.assertEqual(codes, [401, 401, 429])

    def test_login_is_limited_per_username_across_ips(self):
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'auth': '100/min', 'auth_identifier': '2/min'}):
            alice = [self._login('alice', f'198.51.100.{n}') for n in range(3)]
            bob = self._login('bob', '198.51.100.50')
        self.assertEqual(alice, [401, 401, 429])
        self.assertEqual(bob, 401)

    def test_password_reset_is_limited_per_email_across_ips(self):
        def reset(email, ip):
            return APIClient().post(
                '/api/auth/password-reset/', {'email': email}, format='json', HTTP_X_FORWARDED_FOR=ip,
            ).status_code
        with patch.dict(SimpleRateThrottle.THROTTLE_RATES, {'auth': '100/min', 'auth_identifier': '2/min'}):
            same_email = [reset('ALICE@example.com', f'198.51.100.{n}') for n in range(3)]
            other = reset('bob@example.com', '198.51.100.60')
        self.assertEqual(same_email, [200, 200, 429])
        self.assertEqual(other, 200)


class OrganizationProfileApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='org_user', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_or_create_organization_profile(self):
        res = self.client.get('/api/organization/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['company_name'], 'InvoicePro')
        self.assertTrue(OrganizationProfile.objects.filter(owner=self.user).exists())

    def test_update_organization_profile(self):
        res = self.client.post('/api/organization/', {
            'company_name': 'Acme Corp',
            'tax_id': 'VAT-998877',
            'email': 'billing@acme.com',
            'phone': '+977-9800000000',
            'address': 'Kathmandu, Nepal',
            'website': 'https://acme.com',
            'bank_details': 'Nabil Bank\nA/C: 1234567890',
            'invoice_notes': 'Thank you for your business.',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['company_name'], 'Acme Corp')
        self.assertEqual(res.data['tax_id'], 'VAT-998877')

        # Verify persisted
        profile = OrganizationProfile.objects.get(owner=self.user)
        self.assertEqual(profile.company_name, 'Acme Corp')
        self.assertEqual(profile.tax_id, 'VAT-998877')


class InvoiceDuplicateApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='dup_user', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = make_customer(owner=self.user)
        self.invoice = make_invoice(self.customer, 'KIT-501', items=[(2, 50), (1, 100)])
        self.invoice.status = 'paid'
        self.invoice.save()

    def test_duplicate_invoice_creates_draft_with_cloned_items(self):
        res = self.client.post(f'/api/invoices/{self.invoice.id}/duplicate/')
        self.assertEqual(res.status_code, 201)
        data = res.data
        self.assertEqual(data['status'], 'draft')
        self.assertNotEqual(data['id'], self.invoice.id)
        self.assertNotEqual(data['invoice_number'], self.invoice.invoice_number)
        self.assertEqual(len(data['line_items']), 2)
        self.assertEqual(Decimal(data['total']), Decimal('200.00'))

    def test_duplicate_other_user_invoice_denied(self):
        other_user = User.objects.create_user(username='other_dup', password='password123')
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        res = other_client.post(f'/api/invoices/{self.invoice.id}/duplicate/')
        self.assertEqual(res.status_code, 404)


class PaymentApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pay_user', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = make_customer(owner=self.user)
        self.invoice = make_invoice(self.customer, 'KIT-901', items=[(1, 100)])  # total = 100.00
        self.invoice.status = 'sent'
        self.invoice.save()

    def test_partial_payment_updates_balance_due(self):
        res = self.client.post('/api/payments/', {
            'invoice': self.invoice.id,
            'amount': '40.00',
            'payment_date': '2026-01-15',
            'payment_method': 'bank_transfer',
            'reference': 'TX-12345',
            'notes': 'First installment',
        }, format='json')
        self.assertEqual(res.status_code, 201)

        # Check invoice
        inv_res = self.client.get(f'/api/invoices/{self.invoice.id}/')
        self.assertEqual(inv_res.status_code, 200)
        self.assertEqual(inv_res.data['amount_paid'], '40.00')
        self.assertEqual(inv_res.data['balance_due'], '60.00')
        self.assertEqual(len(inv_res.data['payments']), 1)
        self.assertEqual(inv_res.data['status'], 'sent')

    def test_full_payment_automatically_marks_invoice_paid(self):
        res = self.client.post('/api/payments/', {
            'invoice': self.invoice.id,
            'amount': '100.00',
            'payment_date': '2026-01-15',
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(res.status_code, 201)

        inv_res = self.client.get(f'/api/invoices/{self.invoice.id}/')
        self.assertEqual(inv_res.data['amount_paid'], '100.00')
        self.assertEqual(inv_res.data['balance_due'], '0.00')
        self.assertEqual(inv_res.data['status'], 'paid')

    def test_delete_payment_reverts_status_if_balance_remains(self):
        # Create full payment
        pay = Payment.objects.create(
            owner=self.user,
            invoice=self.invoice,
            amount=Decimal('100.00'),
            payment_method='cash',
        )
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, 'paid')

        # Delete payment
        del_res = self.client.delete(f'/api/payments/{pay.id}/')
        self.assertEqual(del_res.status_code, 204)

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, 'sent')
        self.assertEqual(self.invoice.balance_due, Decimal('100.00'))

    def test_payment_for_another_user_invoice_denied(self):
        other_user = User.objects.create_user(username='other_pay', password='password123')
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)

        res = other_client.post('/api/payments/', {
            'invoice': self.invoice.id,
            'amount': '50.00',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class PublicInvoiceApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pub_user', password='password123')
        self.customer = make_customer(owner=self.user)
        self.invoice = make_invoice(self.customer, 'KIT-777', items=[(2, 50)])
        self.client = APIClient()  # Unauthenticated!

    def test_unauthenticated_client_can_view_invoice_by_share_token(self):
        res = self.client.get(f'/api/public-invoices/{self.invoice.share_token}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['invoice_number'], 'KIT-777')
        self.assertEqual(res.data['total'], '100.00')
        self.assertEqual(res.data['customer']['customer_display_name'], 'Customer 1')
        self.assertIn('organization', res.data)

    def test_unauthenticated_client_with_invalid_token_gets_404(self):
        import uuid
        res = self.client.get(f'/api/public-invoices/{uuid.uuid4()}/')
        self.assertEqual(res.status_code, 404)

    def test_unauthenticated_client_can_download_pdf_by_share_token(self):
        res = self.client.get(f'/api/public-invoices/{self.invoice.share_token}/pdf/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')


class CsvExportApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='csv_user', password='password123')
        self.customer = make_customer(owner=self.user)
        self.invoice = make_invoice(self.customer, 'KIT-888', items=[(1, 150)])
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_export_invoices_csv(self):
        res = self.client.get('/api/invoices/export_csv/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'text/csv')
        content = res.content.decode('utf-8')
        self.assertIn('Invoice Number,Customer,Invoice Date', content)
        self.assertIn('KIT-888', content)

    def test_export_customers_csv(self):
        res = self.client.get('/api/customers/export_csv/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'text/csv')
        content = res.content.decode('utf-8')
        self.assertIn('Display Name,First Name,Last Name', content)
        self.assertIn(self.customer.customer_display_name, content)


class InvoiceActivityAndFeaturesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='activity_user', password='password123')
        self.customer = make_customer(owner=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_creating_invoice_logs_created_activity(self):
        payload = {
            'customer_name': self.customer.id,
            'invoice_number': 'INV-ACT-001',
            'invoice_date': '2026-03-01',
            'due_date': '2026-03-31',
            'subject': 'Consulting',
            'status': 'draft',
            'notes': 'Thank you!',
            'terms': 'Net 30 days',
            'line_items': [{'items_details': 'Development', 'quantity': '10', 'rate': '100.00'}],
        }
        res = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        invoice = Invoice.objects.get(pk=res.data['id'])
        self.assertEqual(invoice.notes, 'Thank you!')
        self.assertEqual(invoice.terms, 'Net 30 days')
        self.assertTrue(invoice.activities.filter(activity_type='created').exists())

    def test_send_email_updates_status_and_logs_sent_activity(self):
        invoice = make_invoice(self.customer, 'INV-ACT-002')
        with patch('management.api.send_invoice_email.delay') as mock_task:
            res = self.client.post(f'/api/invoices/{invoice.id}/send_email/', {'to': 'client@example.com'})
            self.assertEqual(res.status_code, 202)
            mock_task.assert_called_once()
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, 'sent')
        self.assertTrue(invoice.activities.filter(activity_type='sent').exists())

    def test_send_reminder_action(self):
        invoice = make_invoice(self.customer, 'INV-ACT-003')
        invoice.status = 'sent'
        invoice.save()
        with patch('management.api.send_due_date_email.delay') as mock_task:
            res = self.client.post(f'/api/invoices/{invoice.id}/send_reminder/')
            self.assertEqual(res.status_code, 200)
            mock_task.assert_called_once_with(invoice.id)
        self.assertTrue(invoice.activities.filter(activity_type='reminder').exists())

    def test_send_reminder_on_paid_invoice_returns_400(self):
        invoice = make_invoice(self.customer, 'INV-ACT-004')
        invoice.status = 'paid'
        invoice.save()
        res = self.client.post(f'/api/invoices/{invoice.id}/send_reminder/')
        self.assertEqual(res.status_code, 400)

    def test_payment_recording_and_deletion_logs_activity(self):
        invoice = make_invoice(self.customer, 'INV-ACT-005', items=[(1, 100)])
        res = self.client.post('/api/payments/', {
            'invoice': invoice.id,
            'amount': '50.00',
            'payment_method': 'bank_transfer',
            'reference': 'TXN-999',
        })
        self.assertEqual(res.status_code, 201)
        payment_id = res.data['id']
        self.assertTrue(invoice.activities.filter(activity_type='payment').exists())

        del_res = self.client.delete(f'/api/payments/{payment_id}/')
        self.assertEqual(del_res.status_code, 204)
        self.assertTrue(invoice.activities.filter(activity_type='payment_deleted').exists())

    def test_public_view_tracks_views_and_activity(self):
        invoice = make_invoice(self.customer, 'INV-ACT-006')
        public_client = APIClient()  # unauthenticated
        res = public_client.get(f'/api/public-invoices/{invoice.share_token}/')
        self.assertEqual(res.status_code, 200)
        invoice.refresh_from_db()
        self.assertIsNotNone(invoice.first_viewed_at)
        self.assertEqual(invoice.view_count, 1)
        self.assertTrue(invoice.activities.filter(activity_type='viewed').exists())

    def test_duplicate_invoice_copies_notes_and_terms(self):
        invoice = make_invoice(self.customer, 'INV-ACT-007')
        invoice.notes = 'Special note'
        invoice.terms = 'Payment within 7 days'
        invoice.save()
        res = self.client.post(f'/api/invoices/{invoice.id}/duplicate/')
        self.assertEqual(res.status_code, 201)
        new_inv = Invoice.objects.get(pk=res.data['id'])
        self.assertEqual(new_inv.notes, 'Special note')
        self.assertEqual(new_inv.terms, 'Payment within 7 days')




