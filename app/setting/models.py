from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server

from app.abstractions.models import AbstractModel


class SymbolModel(AbstractModel):
    """
    Модель символов
    """

    name = models.CharField(
        verbose_name='Название',
        help_text='Пример: BTCUSDT',
        max_length=40,
    )
    is_active = models.BooleanField(
        verbose_name='Активно',
        help_text='Разрешено открытие новых позиций',
    )
    qty_USDT_for_order = models.IntegerField(
        verbose_name='Сумма USDT для позиции',
    )
    class Meta:
        verbose_name = 'Символ'
        verbose_name_plural = 'Символы'

    def __str__(self):
        return self.name


class BanSymbolModel(AbstractModel):
    """
    Модель блокировок символа
    """
    key = models.CharField(
        verbose_name='Блокировка',
        max_length=40,
    )
    value = models.IntegerField(
        verbose_name='Значение',
    )
    symbol = models.ForeignKey(
        SymbolModel,
        on_delete=models.CASCADE,
        related_name='bans',
        verbose_name='Символ'
    )

    class Meta:
        verbose_name = 'Блокировка символа'
        verbose_name_plural = 'Блокировки символа'


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