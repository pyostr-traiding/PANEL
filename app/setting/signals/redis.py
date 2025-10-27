from django.db.models.signals import post_save
from django.dispatch import receiver

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.setting.models import SymbolModel, BanSymbolModel


# Сигнал для автоматического создания блокировок при создании символа
@receiver(post_save, sender=SymbolModel)
def create_bans_for_symbol(sender, instance, created, **kwargs):
    if created:
        # словарь ключ:значение для каждой блокировки
        bans_data = {
            'short': 0,
            'long': 0,
            'sleep': 30,
        }
        for key, value in bans_data.items():
            BanSymbolModel.objects.create(symbol=instance, key=key, value=value)


# Сигнал для автоматической записи в Redis
@receiver(post_save, sender=BanSymbolModel)
def update_redis_for_ban(sender, instance, **kwargs):
    redis_key = f"settings:{instance.symbol.name}:{instance.key}"
    redis_server.set(redis_key, instance.value, db=RedisDB.settings)
