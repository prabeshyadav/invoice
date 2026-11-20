from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('management', '0023_owner_backfill'),
    ]

    operations = [
        migrations.AlterField(
            model_name='addcustomer',
            name='owner',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='customers', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='owner',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='items',
            name='owner',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='catalog_items', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='addcustomer',
            name='email',
            field=models.EmailField(max_length=254),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='invoice_number',
            field=models.CharField(max_length=25),
        ),
        migrations.AddConstraint(
            model_name='addcustomer',
            constraint=models.UniqueConstraint(fields=('owner', 'email'), name='unique_customer_email_per_owner'),
        ),
        migrations.AddConstraint(
            model_name='invoice',
            constraint=models.UniqueConstraint(fields=('owner', 'invoice_number'), name='unique_invoice_number_per_owner'),
        ),
    ]
