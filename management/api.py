"""REST API (JWT) under /api/. Every queryset is scoped to request.user."""

from django.core.mail import EmailMessage
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.generics import CreateAPIView
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from .models import AddCustomer, Invoice, Items, TableItems
from .serializers import (
    AddCustomerSerializer,
    InvoiceSerializer,
    ItemsSerializer,
    RegisterSerializer,
    TableItemsSerializer,
)
from .pdf import render_to_pdf


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
        to_email = request.data.get('to', invoice.customer_name.email)
        subject = request.data.get('subject', f'Invoice {invoice.invoice_number}')
        message = request.data.get(
            'message',
            f'Please find attached invoice {invoice.invoice_number} '
            f'due on {invoice.due_date}.',
        )
        email = EmailMessage(subject, message, None, [to_email])
        pdf_response = render_to_pdf('invoice_pdf.html', self._pdf_context(invoice))
        if pdf_response is not None:
            email.attach(
                f'invoice-{invoice.invoice_number}.pdf',
                pdf_response.content,
                'application/pdf',
            )
        email.send()
        return Response({'detail': f'Invoice sent to {to_email}.'})


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


router = DefaultRouter()
router.register('customers', AddCustomerViewSet, basename='api-customers')
router.register('invoices', InvoiceViewSet, basename='api-invoices')
router.register('line-items', TableItemsViewSet, basename='api-line-items')
router.register('items', ItemsViewSet, basename='api-items')
