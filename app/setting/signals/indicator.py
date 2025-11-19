import json

from django.db.models.signals import post_save
from django.dispatch import receiver
from twisted.web.http import value

from app.setting.models import BanSymbolModel, SymbolModel, IndicatorSettingsModel
from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server


@receiver(post_save, sender=IndicatorSettingsModel)
def save_indicator_redis(sender, instance, created, **kwargs):
    key = f'settings:indicator:{instance.name}'

    redis_server.set(key=key, value=json.dumps(instance.json), db=RedisDB.settings)
