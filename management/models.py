from datetime import date
from decimal import ROUND_HALF_UP, Decimal
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from invoice import commons
from django.utils.crypto import get_random_string


PERCENT_VALIDATORS = [MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))]


def money(value):
    """Round a Decimal to cents, half up (how invoices are conventionally rounded)."""
    return Decimal(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class AddCustomer(models.Model):
    """for handling customer details"""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='customers')
    customer_type = models.CharField(max_length=255, choices=commons.CUSTOMER_CHOICES, blank=True)
    primary_contact=models.CharField(max_length=255,choices=commons.SALUTATION_CHOICES)
    first_name=models.CharField(max_length=225)
    last_name=models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    customer_display_name=models.CharField(max_length=255)
    
    
    currency=models.CharField(max_length=255,choices=commons.CURRENCY_CHOICES)
    individual_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=15)
    website = models.CharField(max_length=255, blank=True)
    mobile=models.CharField(max_length=255)
    #other details part
    
    Portal_Language=models.CharField(max_length=255,choices=commons.LANGUAGE_CHOICES, blank=True)
    
    facebook=models.CharField( max_length=50, blank=True)
    twitter=models.CharField( max_length=50, blank=True)

    
    def fullname(self):
        return f"{self.first_name} {self.last_name}"
    
    def __str__(self):
        return self.fullname()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['owner', 'email'], name='unique_customer_email_per_owner'),
        ]
    
class Invoice(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices')
    customer_name=models.ForeignKey( AddCustomer,on_delete=models.CASCADE, related_name="invoices")
    invoice_number=models.CharField(max_length=25)
    
    invoice_date=models.DateField()
    due_date=models.DateField()
    subject=models.CharField(max_length=255)
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft', blank=True, null=True)
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0'), validators=PERCENT_VALIDATORS
    )
    tax_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0'), validators=PERCENT_VALIDATORS
    )
    share_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    notes = models.TextField(blank=True)
    terms = models.TextField(blank=True)
    first_viewed_at = models.DateTimeField(null=True, blank=True)
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['owner', 'invoice_number'], name='unique_invoice_number_per_owner'),
        ]
    # def __str__(self):
    #     return f"Invoice of id {self.id}"
    
    # # def save(self,*args, **kwargs):
    # #     # generate random alphanumeric invoice number 
    # #     # this also handles if the random number is already existed in db
    # #     if not self.invoice_number:
    # #         invoice_number = get_random_string(length=6)
    # #         has_invoice_id = Invoice.objects.filter(invoice_number=invoice_number).exists()
    # #         count = 1
    # #         while has_invoice_id:
    # #             count += 1
    # #             invoice_number = invoice_number + str(count)
    # #             has_invoice_id = Invoice.objects.filter(invoice_number=invoice_number).exists()
    # #         self.invoice_number = invoice_number.upper()
    # #     super().save(*args, **kwargs)
        
    
    @property
    def sub_total(self):
        # .all() reuses prefetch_related('tableitems_set') from list views.
        return money(sum((item.amount for item in self.tableitems_set.all()), Decimal('0')))

    @property
    def discount_amount(self):
        return money(self.sub_total * self.discount_percent / 100)

    @property
    def discounted_total_amount(self):
        """Sub total after discount, before tax (the taxable amount)."""
        return self.sub_total - self.discount_amount

    @property
    def tax_amount(self):
        return money(self.discounted_total_amount * self.tax_percent / 100)

    @property
    def total(self):
        return self.discounted_total_amount + self.tax_amount

    @property
    def amount_paid(self):
        recorded = sum((p.amount for p in self.payments.all()), Decimal('0'))
        if recorded > Decimal('0'):
            return money(recorded)
        if self.status == 'paid':
            return self.total
        return Decimal('0.00')

    @property
    def balance_due(self):
        return max(Decimal('0.00'), self.total - self.amount_paid)


class Items(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='catalog_items')
    type=models.CharField( max_length=50,choices=commons.ITEM_CHOICES,blank=True)
    name=models.CharField( max_length=50)
    description=models.TextField()
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, validators=PERCENT_VALIDATORS)
    unit=models.CharField(max_length=255)

class TableItems(models.Model):
    items_details=models.CharField(max_length=225)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    invoice=models.ForeignKey(Invoice,on_delete=models.CASCADE, null=True)
    
    
    @property
    def amount(self):
        return money(self.quantity * self.rate)


class OrganizationProfile(models.Model):
    """Business branding, tax ID and bank details per owner, used on invoices and PDFs."""
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organization_profile')
    company_name = models.CharField(max_length=255, default='InvoicePro', blank=True)
    tax_id = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    website = models.CharField(max_length=255, blank=True)
    bank_details = models.TextField(blank=True)
    invoice_notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.company_name or 'Profile'} ({self.owner.username})"


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = (
        ('bank_transfer', 'Bank Transfer'),
        ('cash', 'Cash'),
        ('card', 'Credit/Debit Card'),
        ('cheque', 'Cheque'),
        ('digital_wallet', 'Digital Wallet (eSewa / Khalti)'),
        ('other', 'Other'),
    )

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_date = models.DateField(default=date.today)
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHOD_CHOICES, default='bank_transfer')
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"Payment of {self.amount} for {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        invoice = self.invoice
        if invoice.balance_due <= Decimal('0.00') and invoice.status != 'paid':
            invoice.status = 'paid'
            invoice.save(update_fields=['status'])
        if is_new:
            method = self.get_payment_method_display()
            ref_str = f" (Ref: {self.reference})" if self.reference else ""
            InvoiceActivity.objects.create(
                invoice=invoice,
                activity_type='payment',
                message=f"Payment of {self.amount} recorded via {method}{ref_str}",
            )

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        amount = self.amount
        super().delete(*args, **kwargs)
        recorded = sum((p.amount for p in invoice.payments.all()), Decimal('0'))
        if recorded < invoice.total and invoice.status == 'paid':
            invoice.status = 'sent'
            invoice.save(update_fields=['status'])
        InvoiceActivity.objects.create(
            invoice=invoice,
            activity_type='payment_deleted',
            message=f"Payment of {amount} deleted",
        )


class InvoiceActivity(models.Model):
    ACTIVITY_CHOICES = (
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('sent', 'Sent'),
        ('viewed', 'Viewed'),
        ('payment', 'Payment Recorded'),
        ('payment_deleted', 'Payment Deleted'),
        ('reminder', 'Reminder Sent'),
        ('status', 'Status Changed'),
    )

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_CHOICES)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.activity_type} - {self.invoice.invoice_number} ({self.created_at})"




    
