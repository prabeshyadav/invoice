# Generated by Django 4.1 on 2023-06-13 12:09

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0005_alter_addcustomer_portal_language_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='addcustomer',
            old_name='Customer_display_name',
            new_name='customer_display_name',
        ),
    ]
