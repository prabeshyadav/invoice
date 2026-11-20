"""Assign pre-existing rows to an owner before `owner` becomes required.

Rows go to the earliest user (lowest id). If rows exist but there are no
users at all, an inactive placeholder user "legacy-owner" (unusable
password) is created to own them; reassign them in the admin afterwards.
"""
from django.conf import settings
from django.db import migrations

MODELS = ('AddCustomer', 'Invoice', 'Items')


def backfill_owner(apps, schema_editor):
    orphans = [apps.get_model('management', m).objects.filter(owner__isnull=True) for m in MODELS]
    if not any(qs.exists() for qs in orphans):
        return
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    owner = User.objects.order_by('id').first()
    if owner is None:
        # Historical models have no set_unusable_password(); '!' is Django's unusable marker.
        owner = User.objects.create(username='legacy-owner', password='!', is_active=False)
    for qs in orphans:
        qs.update(owner=owner)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('management', '0022_owner_add_nullable'),
    ]

    operations = [
        migrations.RunPython(backfill_owner, migrations.RunPython.noop),
    ]
