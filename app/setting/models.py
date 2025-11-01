from django.db import models

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


class ExchangeModel(AbstractModel):
    class Meta:
        verbose_name = 'Биржа'
        verbose_name_plural = 'Биржи'

    name = models.CharField(
        verbose_name='Биржа',
        max_length=40,
    )

    base_url = models.URLField(
        verbose_name='Базовый URL',
    )

    maker_fee = models.FloatField(
        verbose_name='Комиссия мейкера',
    )

    taker_fee = models.FloatField(
        verbose_name='Комиссия тейкера',
    )
    target_percent = models.FloatField(
        verbose_name='Целевой процент',
    )

    def __str__(self):
        return self.name