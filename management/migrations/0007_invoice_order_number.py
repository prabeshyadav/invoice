# Generated by Django 4.1 on 2023-06-14 10:19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0006_rename_customer_display_name_addcustomer_customer_display_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='order_number',
            field=models.IntegerField(default=122),
            preserve_default=False,
        ),
    ]
