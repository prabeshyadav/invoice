from django.contrib.auth import get_user_model

from .models import Invoice

PREFIX = 'KIT-'
FIRST_NUMBER = 101


def new_invoice_number(owner):
    """Return the owner's next automatic number: KIT-<highest numeric suffix + 1>.

    Call inside transaction.atomic(): the owner's user row is locked so concurrent
    creates for the same owner wait for each other (PostgreSQL). SQLite ignores the
    lock but serializes writes anyway. Numbers that are not KIT-<digits> (entered
    by hand) are ignored, and the suffix is compared as an integer, so KIT-1000
    sorts above KIT-999.
    """
    list(get_user_model().objects.select_for_update().filter(pk=owner.pk).values_list('pk', flat=True))
    suffixes = (
        number[len(PREFIX):]
        for number in Invoice.objects.filter(owner=owner, invoice_number__startswith=PREFIX)
        .values_list('invoice_number', flat=True)
    )
    highest = max((int(s) for s in suffixes if s.isdigit()), default=FIRST_NUMBER - 1)
    return f'{PREFIX}{max(highest + 1, FIRST_NUMBER)}'
