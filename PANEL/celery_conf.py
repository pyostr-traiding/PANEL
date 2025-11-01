import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "PANEL.settings")

app = Celery("PANEL")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
app.conf.beat_schedule_logger = True
