from django.db import models
from invoice import commons
from django.utils.crypto import get_random_string


class AddCustomer(models.Model):
    """for handling customer details"""
    
    customer_type = models.CharField(max_length=255, choices=commons.CUSTOMER_CHOICES, blank=True)
    primary_contact=models.CharField(max_length=255,choices=commons.SALUTATION_CHOICES)
    first_name=models.CharField(max_length=225)
    last_name=models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    customer_display_name=models.CharField(max_length=255)
    
    
    currency=models.CharField(max_length=255,choices=commons.CURRENCY_CHOICES)
    individual_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(unique=True)
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
    
class Invoice(models.Model):
    customer_name=models.ForeignKey( AddCustomer,on_delete=models.CASCADE, related_name="invoices")
    invoice_number=models.CharField(max_length=25,unique=True)
    
    order_number=models.IntegerField()
    invoice_date=models.DateField()
    due_date=models.DateField()
    subject=models.CharField(max_length=255)
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft', blank=True, null=True)
    def __str__(self):
        return f"Invoice of id {self.id}"
    
    def save(self,*args, **kwargs):
        # generate random alphanumeric invoice number 
        # this also handles if the random number is already existed in db
        if not self.invoice_number:
            invoice_number = get_random_string(length=6)
            has_invoice_id = Invoice.objects.filter(invoice_number=invoice_number).exists()
            count = 1
            while has_invoice_id:
                count += 1
                invoice_number = invoice_number + str(count)
                has_invoice_id = Invoice.objects.filter(invoice_number=invoice_number).exists()
            self.invoice_number = invoice_number.upper()
        super().save(*args, **kwargs)
        
    
    @property
    def sub_total(self):
        items = TableItems.objects.filter(invoice=self)
        
        total =0
        for item in items:
            total = total+ item.amount

            
        return total
    @property
    def discounted_total_amount(self):
        discount_percent = 20  # Assuming a discount of 10%, you can replace this with the actual discount value
        discount = (discount_percent / 100) * self.sub_total
        return self.sub_total - discount

    @property
    def discount_amount(self):
        d_amount = self.sub_total - self.discounted_total_amount
        rounded_d_amount = round(d_amount, 3)
        return rounded_d_amount
        
    
class Items(models.Model):
    type=models.CharField( max_length=50,choices=commons.ITEM_CHOICES,blank=True)
    name=models.CharField( max_length=50)
    description=models.TextField()
    selling_price=models.IntegerField()
    tax=models.IntegerField()
    unit=models.CharField(max_length=255)

class TableItems(models.Model):
    items_details=models.CharField(max_length=225)
    quality=models.IntegerField()
    rate=models.IntegerField()
    invoice=models.ForeignKey(Invoice,on_delete=models.CASCADE)
    
    
    @property
    def amount(self):
        return self.quality * self.rate
    
