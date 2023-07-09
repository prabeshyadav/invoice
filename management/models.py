from django.db import models
from invoice import commons


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
    customer_name=models.ForeignKey( AddCustomer,on_delete=models.CASCADE)
    invoice_number=models.IntegerField()
    
    order_number=models.IntegerField()
    invoice_date=models.DateField()
    due_date=models.DateField()
    subject=models.CharField(max_length=255)
    
    
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
    amount=models.IntegerField()
    invoice=models.ForeignKey(Invoice,on_delete=models.CASCADE)