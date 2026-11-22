# Generated manually for Invoice activity, tracking and notes

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0028_invoice_share_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='terms',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='first_viewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='invoice',
            name='view_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='InvoiceActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('activity_type', models.CharField(choices=[('created', 'Created'), ('updated', 'Updated'), ('sent', 'Sent'), ('viewed', 'Viewed'), ('payment', 'Payment Recorded'), ('payment_deleted', 'Payment Deleted'), ('reminder', 'Reminder Sent'), ('status', 'Status Changed')], max_length=20)),
                ('message', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to='management.invoice')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
