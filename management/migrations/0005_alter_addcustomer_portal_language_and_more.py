# Generated by Django 4.1 on 2023-06-13 11:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0004_addcustomer_mobile'),
    ]

    operations = [
        migrations.AlterField(
            model_name='addcustomer',
            name='Portal_Language',
            field=models.CharField(blank=True, choices=[('ENGLISH', 'ENGLISH'), ('NEPALI', 'NEPALI')], max_length=255),
        ),
        migrations.AlterField(
            model_name='addcustomer',
            name='customer_type',
            field=models.CharField(blank=True, choices=[('business', 'business'), ('individual', 'individual')], max_length=255),
        ),
        migrations.AlterField(
            model_name='addcustomer',
            name='facebook',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='addcustomer',
            name='twitter',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
