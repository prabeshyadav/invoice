from datetime import timedelta
from smtplib import SMTPException

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from .models import Invoice, OrganizationProfile
from .pdf import render_to_pdf


@shared_task
def send_due_date_reminders():
    """Queue a reminder for each unpaid invoice due in REMINDER_DAYS_BEFORE_DUE days.

    Beat runs this once a day and it matches an exact due date, so each invoice
    is reminded once without storing a "reminder sent" flag.
    """
    due_date = timezone.localdate() + timedelta(days=settings.REMINDER_DAYS_BEFORE_DUE)
    invoice_ids = list(
        Invoice.objects.filter(due_date=due_date)
        .exclude(status='paid')
        .values_list('id', flat=True)
    )
    for invoice_id in invoice_ids:
        send_due_date_email.delay(invoice_id)
    return len(invoice_ids)


@shared_task(autoretry_for=(SMTPException, OSError), retry_backoff=True, max_retries=3)
def send_due_date_email(invoice_id):
    invoice = (
        Invoice.objects.select_related('customer_name')
        .filter(pk=invoice_id)
        .first()
    )
    if invoice is None or invoice.status == 'paid':
        return

    customer = invoice.customer_name
    share_url = f"{settings.FRONTEND_URL}/invoices/view/{invoice.share_token}"
    html = render_to_string(
        'email_templates/due_date_email.html',
        {'invoice': invoice, 'customer': customer, 'share_url': share_url},
    )
    email = EmailMultiAlternatives(
        subject=f'Reminder: invoice {invoice.invoice_number} is due on {invoice.due_date:%d %b %Y}',
        body=strip_tags(html),
        to=[customer.email],
    )
    email.attach_alternative(html, 'text/html')
    profile, _ = OrganizationProfile.objects.get_or_create(
        owner=invoice.owner,
        defaults={'company_name': 'InvoicePro', 'email': invoice.owner.email}
    )
    pdf = render_to_pdf('invoice_pdf.html', {
        'invoice_object': invoice,
        'invoice_items': invoice.tableitems_set.all(),
        'organization': profile,
    })
    if pdf is not None:
        email.attach(f'invoice-{invoice.invoice_number}.pdf', pdf.content, 'application/pdf')
    email.send()


@shared_task(autoretry_for=(SMTPException, OSError), retry_backoff=True, max_retries=3)
def send_invoice_email(invoice_id, to, subject, message):
    """Email an invoice PDF. Queued by POST /api/invoices/{id}/send_email/, which
    has already checked ownership, so the request isn't held up by PDF and SMTP work."""
    invoice = Invoice.objects.filter(pk=invoice_id).first()
    if invoice is None:
        return
    email = EmailMultiAlternatives(subject=subject, body=message, to=[to])
    profile, _ = OrganizationProfile.objects.get_or_create(
        owner=invoice.owner,
        defaults={'company_name': 'InvoicePro', 'email': invoice.owner.email}
    )
    pdf = render_to_pdf('invoice_pdf.html', {
        'invoice_object': invoice,
        'invoice_items': invoice.tableitems_set.all(),
        'organization': profile,
    })
    if pdf is not None:
        email.attach(f'invoice-{invoice.invoice_number}.pdf', pdf.content, 'application/pdf')
    email.send()
