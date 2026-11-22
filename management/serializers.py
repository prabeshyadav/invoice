from contextlib import contextmanager

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import AddCustomer, Invoice, InvoiceActivity, Items, OrganizationProfile, Payment, TableItems
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


@contextmanager
def _duplicate_number_as_400():
    """Run the write atomically; a unique clash that slipped past validation
    (two requests at once) becomes a 400 on invoice_number instead of a 500."""
    try:
        with transaction.atomic():
            yield
    except IntegrityError:
        raise serializers.ValidationError(
            {'invoice_number': ['This invoice number is already in use. Please try again.']}
        )


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
        extra_kwargs = {
            'phone': {'required': False, 'allow_blank': True},
        }


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


class PaymentSerializer(serializers.ModelSerializer):
    invoice = OwnedPrimaryKeyRelatedField(queryset=Invoice.objects.all())

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'amount', 'payment_date', 'payment_method',
            'reference', 'notes', 'created_at',
        ]

    def validate_amount(self, value):
        from decimal import Decimal
        if value <= Decimal('0.00'):
            raise serializers.ValidationError('Payment amount must be greater than zero.')
        return value


class InvoiceActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceActivity
        fields = ['id', 'activity_type', 'message', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = TableItemsSerializer(many=True, source='tableitems_set', required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    activities = InvoiceActivitySerializer(many=True, read_only=True)
    sub_total = money_field()
    discount_amount = money_field()
    discounted_total_amount = money_field()
    tax_amount = money_field()
    total = money_field()
    amount_paid = money_field()
    balance_due = money_field()
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
            'id', 'share_token', 'customer_name', 'customer_display_name', 'invoice_number', 'invoice_date', 'due_date',
            'subject', 'status', 'discount_percent', 'tax_percent', 'notes', 'terms', 'first_viewed_at', 'view_count',
            'line_items', 'payments', 'activities',
            'sub_total', 'discount_amount', 'discounted_total_amount', 'tax_amount',
            'total', 'amount_paid', 'balance_due',
        ]
        extra_kwargs = {
            'invoice_number': {'required': False},
            'share_token': {'read_only': True},
            'first_viewed_at': {'read_only': True},
            'view_count': {'read_only': True},
        }

    def create(self, validated_data):
        items_data = validated_data.pop('tableitems_set', [])
        with _duplicate_number_as_400():
            if not validated_data.get('invoice_number'):
                validated_data['invoice_number'] = new_invoice_number(validated_data['owner'])
            invoice = Invoice.objects.create(**validated_data)
            for item_data in items_data:
                item_data.pop('invoice', None)
                TableItems.objects.create(invoice=invoice, **item_data)
            InvoiceActivity.objects.create(
                invoice=invoice,
                activity_type='created',
                message=f'Invoice {invoice.invoice_number} created',
            )
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('tableitems_set', None)
        old_status = instance.status
        with _duplicate_number_as_400():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if items_data is not None:
                instance.tableitems_set.all().delete()
                for item_data in items_data:
                    item_data.pop('invoice', None)
                    TableItems.objects.create(invoice=instance, **item_data)
            if old_status != instance.status:
                InvoiceActivity.objects.create(
                    invoice=instance,
                    activity_type='status',
                    message=f'Status marked as {instance.get_status_display()}',
                )
        return instance


class SendEmailSerializer(serializers.Serializer):
    """Optional overrides for POST /api/invoices/{id}/send_email/."""
    to = serializers.EmailField(required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True, max_length=255)
    message = serializers.CharField(required=False, allow_blank=True)


class DashboardInvoiceSerializer(serializers.ModelSerializer):
    """The invoice fields the dashboard lists need (no line items)."""
    customer_display_name = serializers.CharField(
        source='customer_name.customer_display_name', read_only=True
    )
    total = money_field()
    amount_paid = money_field()
    balance_due = money_field()

    class Meta:
        model = Invoice
        fields = [
            'id', 'share_token', 'customer_name', 'customer_display_name', 'invoice_number',
            'invoice_date', 'due_date', 'subject', 'status', 'total',
            'amount_paid', 'balance_due', 'first_viewed_at',
        ]


class PublicCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddCustomer
        fields = ['customer_display_name', 'company_name', 'email', 'phone', 'currency']


class PublicInvoiceSerializer(serializers.ModelSerializer):
    line_items = TableItemsSerializer(many=True, source='tableitems_set', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer = PublicCustomerSerializer(source='customer_name', read_only=True)
    organization = serializers.SerializerMethodField()
    sub_total = money_field()
    discount_amount = money_field()
    discounted_total_amount = money_field()
    tax_amount = money_field()
    total = money_field()
    amount_paid = money_field()
    balance_due = money_field()

    class Meta:
        model = Invoice
        fields = [
            'id', 'share_token', 'invoice_number', 'invoice_date', 'due_date',
            'subject', 'status', 'discount_percent', 'tax_percent', 'notes', 'terms', 'line_items', 'payments',
            'sub_total', 'discount_amount', 'discounted_total_amount', 'tax_amount',
            'total', 'amount_paid', 'balance_due', 'customer', 'organization',
        ]

    def get_organization(self, obj):
        profile, _ = OrganizationProfile.objects.get_or_create(
            owner=obj.owner,
            defaults={'company_name': 'InvoicePro', 'email': obj.owner.email}
        )
        return OrganizationProfileSerializer(profile).data


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


class OrganizationProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationProfile
        fields = [
            'id', 'company_name', 'tax_id', 'email', 'phone',
            'address', 'website', 'bank_details', 'invoice_notes',
        ]

