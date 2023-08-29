from .models import Invoice
from django.core.exceptions import ObjectDoesNotExist

def new_invoice_number():
    """returns new invoice number by adding numbers to the last invoice number"""
    try:
        latest_invoice_number = Invoice.objects.filter(invoice_number__startswith="KIT").latest('id').invoice_number    #fetches latest invoice_number starting with "KIT"
        invoice_number_part = latest_invoice_number.split('-')[1]   #returns like this 101 in string
        int_invoice_number = int(invoice_number_part)   # 101 in int
        increment_number = int_invoice_number + 1  #adds 1 to above ex: 102 in int
        str_increment_number = str(increment_number) #returns 102  in string
        
        first_part = latest_invoice_number.split('-')[0]    #returns "KIT"
        new_invoice_number = first_part + "-" + str_increment_number     #concatenates and returns like KIT-102
    except ObjectDoesNotExist:
        new_invoice_number = "KIT-101"
    return new_invoice_number
