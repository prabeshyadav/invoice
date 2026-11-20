from django.contrib import admin

from .models import AddCustomer, Invoice, Items, TableItems


@admin.register(AddCustomer)
class AddCustomerAdmin(admin.ModelAdmin):
    list_display = ('customer_display_name', 'email', 'owner')
    list_filter = ('owner',)
    search_fields = ('customer_display_name', 'email')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'customer_name', 'due_date', 'status', 'owner')
    list_filter = ('owner', 'status')
    list_select_related = ('customer_name', 'owner')
    search_fields = ('invoice_number', 'subject')


@admin.register(Items)
class ItemsAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'selling_price', 'owner')
    list_filter = ('owner', 'type')


@admin.register(TableItems)
class TableItemsAdmin(admin.ModelAdmin):
    list_display = ('items_details', 'invoice', 'quantity', 'rate')
    list_filter = ('invoice__owner',)
    list_select_related = ('invoice',)
