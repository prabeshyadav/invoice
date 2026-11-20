# Load the Celery app with Django so @shared_task.delay() from web requests
# uses CELERY_BROKER_URL (Redis) instead of Celery's default amqp://localhost.
from .celery import app as celery_app

__all__ = ('celery_app',)
