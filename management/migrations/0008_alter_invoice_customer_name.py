# Generated by Django 4.1 on 2023-06-16 07:32

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0007_invoice_order_number'),
    ]

    operations = [
        migrations.AlterField(
            model_name='invoice',
            name='customer_name',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='management.addcustomer'),
        ),
    ]