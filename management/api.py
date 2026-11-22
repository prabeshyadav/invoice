"""REST API (JWT) under /api/. Every queryset is scoped to request.user."""

import csv
from datetime import date, timedelta
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import CreateAPIView
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from .models import AddCustomer, Invoice, InvoiceActivity, Items, OrganizationProfile, Payment, TableItems, money
from .serializers import (
    AddCustomerSerializer,
    DashboardInvoiceSerializer,
    InvoiceSerializer,
    ItemsSerializer,
    OrganizationProfileSerializer,
    PaymentSerializer,
    PublicInvoiceSerializer,
    RegisterSerializer,
    SendEmailSerializer,
    TableItemsSerializer,
)
from .pdf import render_to_pdf
from .tasks import send_due_date_email, send_invoice_email
from .utils import new_invoice_number


class RegisterView(CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class OwnedViewSetMixin:
    """Scope every query to request.user and stamp new rows with it.

    Objects owned by someone else are simply not in the queryset, so detail
    routes return 404 for them rather than revealing that they exist.
    """
    owner_lookup = 'owner'

    def get_queryset(self):
        return super().get_queryset().filter(**{self.owner_lookup: self.request.user})

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class AddCustomerViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = AddCustomer.objects.all().order_by('-id')
    serializer_class = AddCustomerSerializer

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        customers = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="customers.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Display Name', 'First Name', 'Last Name', 'Company', 'Type',
            'Email', 'Phone', 'Mobile', 'Currency', 'Website',
        ])
        for c in customers:
            writer.writerow([
                c.customer_display_name,
                c.first_name,
                c.last_name,
                c.company_name,
                c.customer_type,
                c.email,
                c.phone,
                c.mobile,
                c.currency,
                c.website,
            ])
        return response


class InvoiceViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = (
        Invoice.objects.select_related('customer_name')
        .prefetch_related('tableitems_set', 'payments', 'activities')
        .order_by('-id')
    )
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_name_id=customer_id)
        return queryset

    def _pdf_context(self, invoice):
        profile, _ = OrganizationProfile.objects.get_or_create(
            owner=invoice.owner,
            defaults={'company_name': 'InvoicePro', 'email': invoice.owner.email}
        )
        return {
            'invoice_object': invoice,
            'invoice_items': invoice.tableitems_set.all(),
            'organization': profile,
        }

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        today = timezone.localdate()
        days_delta = (source.due_date - source.invoice_date).days if source.due_date >= source.invoice_date else 30
        new_inv = Invoice.objects.create(
            owner=request.user,
            customer_name=source.customer_name,
            invoice_number=new_invoice_number(request.user),
            invoice_date=today,
            due_date=today + timedelta(days=days_delta),
            subject=f"{source.subject} (Copy)",
            status='draft',
            discount_percent=source.discount_percent,
            tax_percent=source.tax_percent,
            notes=source.notes,
            terms=source.terms,
        )
        for item in source.tableitems_set.all():
            TableItems.objects.create(
                invoice=new_inv,
                items_details=item.items_details,
                quantity=item.quantity,
                rate=item.rate,
            )
        InvoiceActivity.objects.create(
            invoice=new_inv,
            activity_type='created',
            message=f'Invoice {new_inv.invoice_number} created (duplicated from {source.invoice_number})',
        )
        return Response(InvoiceSerializer(new_inv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        invoice = self.get_object()
        response = render_to_pdf('invoice_pdf.html', self._pdf_context(invoice))
        if response is None:
            return Response({'detail': 'Could not generate PDF.'}, status=500)
        response['Content-Disposition'] = (
            f'attachment; filename="invoice-{invoice.invoice_number}.pdf"'
        )
        return response

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        params = SendEmailSerializer(data=request.data)
        params.is_valid(raise_exception=True)
        to_email = params.validated_data.get('to') or invoice.customer_name.email
        subject = params.validated_data.get('subject') or f'Invoice {invoice.invoice_number}'
        message = params.validated_data.get('message') or (
            f'Please find attached invoice {invoice.invoice_number} '
            f'due on {invoice.due_date}.'
        )
        if invoice.status == 'draft':
            invoice.status = 'sent'
            invoice.save(update_fields=['status'])
        InvoiceActivity.objects.create(
            invoice=invoice,
            activity_type='sent',
            message=f'Invoice emailed to {to_email}',
        )
        # PDF rendering and SMTP are slow; the worker does them.
        send_invoice_email.delay(invoice.id, to_email, subject, message)
        return Response(
            {'detail': f'Sending invoice to {to_email}…'}, status=status.HTTP_202_ACCEPTED
        )

    @action(detail=True, methods=['post'])
    def send_reminder(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == 'paid' or invoice.balance_due <= Decimal('0.00'):
            return Response({'detail': 'Invoice is already paid.'}, status=status.HTTP_400_BAD_REQUEST)
        to_email = invoice.customer_name.email
        if not to_email:
            return Response({'detail': 'Customer has no email address.'}, status=status.HTTP_400_BAD_REQUEST)
        send_due_date_email.delay(invoice.id)
        InvoiceActivity.objects.create(
            invoice=invoice,
            activity_type='reminder',
            message=f'Payment reminder emailed to {to_email}',
        )
        return Response({'detail': f'Payment reminder sent to {to_email}.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        invoices = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="invoices.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Invoice Number', 'Customer', 'Invoice Date', 'Due Date',
            'Subject', 'Status', 'Subtotal', 'Discount Amount', 'Tax Amount',
            'Total', 'Amount Paid', 'Balance Due',
        ])
        for inv in invoices:
            writer.writerow([
                inv.invoice_number,
                inv.customer_name.customer_display_name,
                inv.invoice_date,
                inv.due_date,
                inv.subject,
                inv.status,
                inv.sub_total,
                inv.discount_amount,
                inv.tax_amount,
                inv.total,
                inv.amount_paid,
                inv.balance_due,
            ])
        return response


class TableItemsViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = TableItems.objects.select_related('invoice').order_by('-id')
    serializer_class = TableItemsSerializer
    owner_lookup = 'invoice__owner'

    def perform_create(self, serializer):
        # Ownership comes from the invoice, which the serializer restricts to request.user.
        serializer.save()

    def get_queryset(self):
        queryset = super().get_queryset()
        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        return queryset


class ItemsViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = Items.objects.all().order_by('-id')
    serializer_class = ItemsSerializer


def display_status(invoice, today):
    """Mirror of the frontend's displayStatus: unpaid and due before today is overdue."""
    if invoice.status != 'paid' and invoice.due_date < today:
        return 'overdue'
    return invoice.status or 'draft'


class DashboardViewSet(viewsets.ViewSet):
    """GET /api/dashboard/: the owner's billing summary in one response.

    Three queries whatever the invoice count: customers count, invoices (with
    customer), line items (prefetched). Totals use Invoice.total so they match
    the invoice pages to the cent.
    """

    def list(self, request):
        today = timezone.localdate()
        invoices = list(
            Invoice.objects.filter(owner=request.user)
            .select_related('customer_name')
            .prefetch_related('tableitems_set', 'payments')
            .order_by('-id')
        )
        customer_count = AddCustomer.objects.filter(owner=request.user).count()

        by_status = {s: {'count': 0, 'amount': Decimal('0')} for s in ('paid', 'sent', 'draft', 'overdue')}
        statuses = {}
        for invoice in invoices:
            s = display_status(invoice, today)
            statuses[invoice.id] = s
            bucket = by_status.setdefault(s, {'count': 0, 'amount': Decimal('0')})
            bucket['count'] += 1
            bucket['amount'] += invoice.total

        billed = sum((b['amount'] for b in by_status.values()), Decimal('0'))
        collected = by_status['paid']['amount']
        outstanding = billed - collected
        upcoming = sorted(
            (i for i in invoices if statuses[i.id] not in ('paid', 'overdue')),
            key=lambda i: (i.due_date, i.id),
        )[:5]

        fmt = lambda value: f'{money(value):.2f}'  # noqa: E731

        # Last 6 calendar months billing & collection trend
        months = []
        curr_y = today.year
        curr_m = today.month
        for offset in range(5, -1, -1):
            m = curr_m - offset
            y = curr_y
            while m <= 0:
                m += 12
                y -= 1
            months.append((y, m))

        trend_data = []
        for y, m in months:
            month_date = date(y, m, 1)
            month_label = month_date.strftime('%b')
            m_invoices = [inv for inv in invoices if inv.invoice_date.year == y and inv.invoice_date.month == m]
            m_billed = sum((inv.total for inv in m_invoices), Decimal('0'))
            m_collected = Decimal('0')
            for inv in invoices:
                for p in inv.payments.all():
                    if p.payment_date.year == y and p.payment_date.month == m:
                        m_collected += p.amount
                if inv.status == 'paid' and not inv.payments.exists() and inv.invoice_date.year == y and inv.invoice_date.month == m:
                    m_collected += inv.total

            trend_data.append({
                'month': month_label,
                'year': y,
                'billed': fmt(m_billed),
                'collected': fmt(m_collected),
            })

        return Response({
            'invoice_count': len(invoices),
            'customer_count': customer_count,
            'totals': {
                'billed': fmt(billed),
                'collected': fmt(collected),
                'outstanding': fmt(outstanding),
                'overdue': fmt(by_status['overdue']['amount']),
            },
            'by_status': {
                s: {'count': b['count'], 'amount': fmt(b['amount'])} for s, b in by_status.items()
            },
            'monthly_trend': trend_data,
            'recent': DashboardInvoiceSerializer(invoices[:6], many=True).data,
            'upcoming': DashboardInvoiceSerializer(upcoming, many=True).data,
        })


class PaymentViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    """CRUD /api/payments/: Record and track payments on invoices."""
    queryset = Payment.objects.select_related('invoice').order_by('-payment_date', '-id')
    serializer_class = PaymentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        return queryset


class OrganizationViewSet(viewsets.ViewSet):
    """GET and POST/PUT /api/organization/: Business profile & branding for invoices."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        profile, _ = OrganizationProfile.objects.get_or_create(
            owner=request.user,
            defaults={'company_name': 'InvoicePro', 'email': request.user.email}
        )
        return Response(OrganizationProfileSerializer(profile).data)

    def create(self, request):
        profile, _ = OrganizationProfile.objects.get_or_create(
            owner=request.user,
            defaults={'company_name': 'InvoicePro', 'email': request.user.email}
        )
        serializer = OrganizationProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PublicInvoiceViewSet(viewsets.ViewSet):
    """Public read-only invoice view for clients via share_token (no auth required)."""
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, pk=None):
        invoice = (
            Invoice.objects.filter(share_token=pk)
            .select_related('customer_name', 'owner')
            .prefetch_related('tableitems_set', 'payments', 'activities')
            .first()
        )
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        update_fields = ['view_count']
        if not invoice.first_viewed_at:
            invoice.first_viewed_at = now
            update_fields.append('first_viewed_at')
        invoice.view_count += 1
        invoice.save(update_fields=update_fields)

        recent_view = invoice.activities.filter(activity_type='viewed').order_by('-created_at').first()
        if not recent_view or (now - recent_view.created_at).total_seconds() > 1800:
            InvoiceActivity.objects.create(
                invoice=invoice,
                activity_type='viewed',
                message='Customer viewed invoice online',
            )

        return Response(PublicInvoiceSerializer(invoice).data)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        invoice = (
            Invoice.objects.filter(share_token=pk)
            .select_related('customer_name', 'owner')
            .prefetch_related('tableitems_set', 'payments')
            .first()
        )
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        profile, _ = OrganizationProfile.objects.get_or_create(
            owner=invoice.owner,
            defaults={'company_name': 'InvoicePro', 'email': invoice.owner.email}
        )
        context = {
            'invoice_object': invoice,
            'invoice_items': invoice.tableitems_set.all(),
            'organization': profile,
        }
        response = render_to_pdf('invoice_pdf.html', context)
        if response is None:
            return Response({'detail': 'Could not generate PDF.'}, status=500)
        response['Content-Disposition'] = f'attachment; filename="invoice-{invoice.invoice_number}.pdf"'
        return response


router = DefaultRouter()
router.register('dashboard', DashboardViewSet, basename='api-dashboard')
router.register('customers', AddCustomerViewSet, basename='api-customers')
router.register('invoices', InvoiceViewSet, basename='api-invoices')
router.register('line-items', TableItemsViewSet, basename='api-line-items')
router.register('items', ItemsViewSet, basename='api-items')
router.register('payments', PaymentViewSet, basename='api-payments')
router.register('organization', OrganizationViewSet, basename='api-organization')
router.register('public-invoices', PublicInvoiceViewSet, basename='api-public-invoices')
