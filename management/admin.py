from django.contrib import admin
from .models import AddCustomer, Invoice,TableItems


admin.site.register(AddCustomer)

admin.site.register(Invoice)
admin.site.register(TableItems)