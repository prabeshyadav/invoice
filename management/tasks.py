# tasks.py
import os
from django.conf import settings
from celery import shared_task
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from .models import Invoice

@shared_task
def send_due_date_email(invoice_id):
    try:
        invoice = Invoice.objects.get(pk=invoice_id)
        customer_email = invoice.customer_name.email
        subject = "Invoice Due Reminder"
        context = {
            "invoice_number": invoice.invoice_number,
            "due_date": invoice.due_date,
            # Add other context variables that you might need in the email template
        }
        html_message = render_to_string("email_templates/due_date_email.html", context)
        plain_message = strip_tags(html_message)

        # Prepare the PDF file path
        pdf_file_path = os.path.join(settings.MEDIA_ROOT, 'download (1).pdf')  # Update with your PDF file name

        # Create the email message with attachment
        email = EmailMessage(subject, plain_message, "prabeshyadav087@gmail.com", [customer_email])
        email.attach_alternative(html_message, "text/html")  # Attach HTML content
        email.attach_file(pdf_file_path)  # Attach the PDF file

        # Send the email
        email.send()
    except Invoice.DoesNotExist:
        pass
