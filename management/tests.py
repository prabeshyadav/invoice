from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.module_loading import import_string
from rest_framework.test import APIClient

from . import tasks
from .models import AddCustomer, Invoice, Items, TableItems


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
            selling_price=10, tax=0, unit='pcs',
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
            'selling_price': 1, 'tax': 0, 'unit': 'pcs', 'owner': self.alice.id,
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
