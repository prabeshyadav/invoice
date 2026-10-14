from django.contrib.auth.models import User
from rest_framework import serializers

from .models import AddCustomer, Invoice, Items, TableItems
from .utils import new_invoice_number


class AddCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddCustomer
        fields = [
            'id', 'customer_type', 'primary_contact', 'first_name', 'last_name',
            'company_name', 'customer_display_name', 'currency', 'individual_name',
            'email', 'phone', 'website', 'mobile', 'Portal_Language',
            'facebook', 'twitter',
        ]


class TableItemsSerializer(serializers.ModelSerializer):
    amount = serializers.ReadOnlyField()

    class Meta:
        model = TableItems
        fields = ['id', 'invoice', 'items_details', 'quantity', 'rate', 'amount']
        extra_kwargs = {'invoice': {'required': False}}


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = TableItemsSerializer(many=True, source='tableitems_set', required=False)
    sub_total = serializers.ReadOnlyField()
    discount_amount = serializers.ReadOnlyField()
    discounted_total_amount = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'customer_name', 'invoice_number', 'invoice_date', 'due_date',
            'subject', 'status', 'line_items', 'sub_total', 'discount_amount',
            'discounted_total_amount',
        ]
        extra_kwargs = {'invoice_number': {'required': False}}

    def create(self, validated_data):
        items_data = validated_data.pop('tableitems_set', [])
        if not validated_data.get('invoice_number'):
            validated_data['invoice_number'] = new_invoice_number()
        invoice = Invoice.objects.create(**validated_data)
        for item_data in items_data:
            TableItems.objects.create(invoice=invoice, **item_data)
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('tableitems_set', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.tableitems_set.all().delete()
            for item_data in items_data:
                TableItems.objects.create(invoice=instance, **item_data)
        return instance


class ItemsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Items
        fields = ['id', 'type', 'name', 'description', 'selling_price', 'tax', 'unit']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
