from django.contrib.auth.models import User
from rest_framework import serializers

from .models import AddCustomer, Invoice, Items, TableItems
from .utils import new_invoice_number


def _validate_unique_for_owner(serializer, model, field, value):
    """Per-owner uniqueness (the DB constraint is on owner + field)."""
    others = model.objects.filter(owner=serializer.context['request'].user, **{field: value})
    if serializer.instance is not None:
        others = others.exclude(pk=serializer.instance.pk)
    if others.exists():
        raise serializers.ValidationError(
            f'You already have a {model._meta.verbose_name} with this {field.replace("_", " ")}.'
        )
    return value


class OwnedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """Accepts only objects owned by the requesting user; others look nonexistent."""

    def __init__(self, owner_lookup='owner', **kwargs):
        self.owner_lookup = owner_lookup
        super().__init__(**kwargs)

    def get_queryset(self):
        return super().get_queryset().filter(**{self.owner_lookup: self.context['request'].user})


def money_field():
    """Computed money value, serialized like stored DecimalFields (a "12.50" string)."""
    return serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)


class AddCustomerSerializer(serializers.ModelSerializer):
    def validate_email(self, value):
        return _validate_unique_for_owner(self, AddCustomer, 'email', value)

    class Meta:
        model = AddCustomer
        fields = [
            'id', 'customer_type', 'primary_contact', 'first_name', 'last_name',
            'company_name', 'customer_display_name', 'currency', 'individual_name',
            'email', 'phone', 'website', 'mobile', 'Portal_Language',
            'facebook', 'twitter',
        ]


class TableItemsSerializer(serializers.ModelSerializer):
    amount = money_field()
    invoice = OwnedPrimaryKeyRelatedField(queryset=Invoice.objects.all(), required=False)

    def validate(self, attrs):
        # Nested under an invoice, the parent supplies it. Standalone it is required,
        # otherwise the row would have no owner and be invisible to everyone.
        if self.root is self and self.instance is None and not attrs.get('invoice'):
            raise serializers.ValidationError({'invoice': 'This field is required.'})
        return attrs

    class Meta:
        model = TableItems
        fields = ['id', 'invoice', 'items_details', 'quantity', 'rate', 'amount']
        extra_kwargs = {'invoice': {'required': False}}


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = TableItemsSerializer(many=True, source='tableitems_set', required=False)
    sub_total = money_field()
    discount_amount = money_field()
    discounted_total_amount = money_field()
    tax_amount = money_field()
    total = money_field()
    customer_display_name = serializers.CharField(
        source='customer_name.customer_display_name', read_only=True
    )
    customer_name = OwnedPrimaryKeyRelatedField(queryset=AddCustomer.objects.all())

    def validate_invoice_number(self, value):
        if not value:
            return value
        return _validate_unique_for_owner(self, Invoice, 'invoice_number', value)

    class Meta:
        model = Invoice
        fields = [
            'id', 'customer_name', 'customer_display_name', 'invoice_number', 'invoice_date', 'due_date',
            'subject', 'status', 'discount_percent', 'tax_percent', 'line_items',
            'sub_total', 'discount_amount', 'discounted_total_amount', 'tax_amount',
            'total',
        ]
        extra_kwargs = {'invoice_number': {'required': False}}

    def create(self, validated_data):
        items_data = validated_data.pop('tableitems_set', [])
        if not validated_data.get('invoice_number'):
            validated_data['invoice_number'] = new_invoice_number(validated_data['owner'])
        invoice = Invoice.objects.create(**validated_data)
        for item_data in items_data:
            item_data.pop('invoice', None)
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
                item_data.pop('invoice', None)
                TableItems.objects.create(invoice=instance, **item_data)
        return instance


class ItemsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Items
        fields = ['id', 'type', 'name', 'description', 'selling_price', 'tax_rate', 'unit']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
