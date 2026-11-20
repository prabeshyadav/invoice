"""REST API (JWT) under /api/. Every queryset is scoped to request.user."""

from decimal import Decimal

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import CreateAPIView
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from .models import AddCustomer, Invoice, Items, TableItems, money
from .serializers import (
    AddCustomerSerializer,
    DashboardInvoiceSerializer,
    InvoiceSerializer,
    ItemsSerializer,
    RegisterSerializer,
    SendEmailSerializer,
    TableItemsSerializer,
)
from .pdf import render_to_pdf
from .tasks import send_invoice_email


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


class InvoiceViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = (
        Invoice.objects.select_related('customer_name')
        .prefetch_related('tableitems_set')
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
        return {
            'invoice_object': invoice,
            'invoice_items': invoice.tableitems_set.all(),
        }

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
        # PDF rendering and SMTP are slow; the worker does them.
        send_invoice_email.delay(invoice.id, to_email, subject, message)
        return Response(
            {'detail': f'Sending invoice to {to_email}…'}, status=status.HTTP_202_ACCEPTED
        )


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
            .prefetch_related('tableitems_set')
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
        upcoming = sorted(
            (i for i in invoices if statuses[i.id] not in ('paid', 'overdue')),
            key=lambda i: (i.due_date, i.id),
        )[:5]

        fmt = lambda value: f'{money(value):.2f}'  # noqa: E731
        return Response({
            'invoice_count': len(invoices),
            'customer_count': customer_count,
            'totals': {
                'billed': fmt(billed),
                'collected': fmt(collected),
                'outstanding': fmt(billed - collected),
                'overdue': fmt(by_status['overdue']['amount']),
            },
            'by_status': {
                s: {'count': b['count'], 'amount': fmt(b['amount'])} for s, b in by_status.items()
            },
            'recent': DashboardInvoiceSerializer(invoices[:6], many=True).data,
            'upcoming': DashboardInvoiceSerializer(upcoming, many=True).data,
        })


router = DefaultRouter()
router.register('dashboard', DashboardViewSet, basename='api-dashboard')
router.register('customers', AddCustomerViewSet, basename='api-customers')
router.register('invoices', InvoiceViewSet, basename='api-invoices')
router.register('line-items', TableItemsViewSet, basename='api-line-items')
router.register('items', ItemsViewSet, basename='api-items')
