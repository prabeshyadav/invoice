from decimal import Decimal

import django.core.validators
from django.db import migrations, models

PERCENT_VALIDATORS = [
    django.core.validators.MinValueValidator(Decimal('0')),
    django.core.validators.MaxValueValidator(Decimal('100')),
]


def keep_legacy_discount(apps, schema_editor):
    # Totals used to apply a hard-coded 10% discount; keep existing invoices unchanged.
    apps.get_model('management', 'Invoice').objects.update(discount_percent=Decimal('10'))


class Migration(migrations.Migration):

    dependencies = [
        ('management', '0024_owner_required_and_unique_per_owner'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tableitems',
            name='quantity',
            field=models.DecimalField(decimal_places=2, max_digits=10),
        ),
        migrations.AlterField(
            model_name='tableitems',
            name='rate',
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name='items',
            name='selling_price',
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.RenameField(
            model_name='items',
            old_name='tax',
            new_name='tax_rate',
        ),
        migrations.AlterField(
            model_name='items',
            name='tax_rate',
            field=models.DecimalField(decimal_places=2, max_digits=5, validators=PERCENT_VALIDATORS),
        ),
        migrations.AddField(
            model_name='invoice',
            name='discount_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=5, validators=PERCENT_VALIDATORS),
        ),
        migrations.AddField(
            model_name='invoice',
            name='tax_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=5, validators=PERCENT_VALIDATORS),
        ),
        migrations.RunPython(keep_legacy_discount, migrations.RunPython.noop),
    ]
