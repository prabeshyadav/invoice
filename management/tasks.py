from celery import shared_task
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils import timezone
from .models import Invoice

@shared_task
def send_due_date_reminders():
    invoices = Invoice.objects.filter(due_date=timezone.now().date())

    for invoice in invoices:
        # Get the customer's email address
        customer_email = invoice.customer_name.email

        # Render the email template with the invoice details
        context = {
            'invoice': invoice,
        }
        email_body = render_to_string('email_templates/invoice_due.html', context)

        # Create the email message
        email = EmailMessage(
            'Invoice Due Reminder',
            email_body,
            'your-email@example.com',
            [customer_email],
        )

        # Attach the PDF file
        pdf_content = open('path/to/your/pdf/file.pdf', 'rb').read()
        email.attach('invoice.pdf', pdf_content, 'application/pdf')

        # Send the email
        email.send()
