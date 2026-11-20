"""Helpers for reading settings from environment variables."""

import os

from django.core.exceptions import ImproperlyConfigured

DEV_SECRET_KEY = 'django-insecure-_0lntjo&0dc%2h@qn)!0%z)$e(anzv2kyqbbc5)qt$r!7_7mg$'


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('true', '1', 't', 'yes')


def env_list(name, default=''):
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


def resolve_secret_key(value, debug):
    """Return the secret key, refusing a missing or insecure one in production."""
    if debug:
        return value or DEV_SECRET_KEY
    if not value or value.startswith('django-insecure'):
        raise ImproperlyConfigured(
            'SECRET_KEY must be set to a strong random value when DEBUG is False.'
        )
    return value
