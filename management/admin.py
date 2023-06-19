from django.contrib import admin
from .models import AddCustomer, Invoice


admin.site.register(AddCustomer)

admin.site.register(Invoice)