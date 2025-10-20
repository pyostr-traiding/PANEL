import uuid

from django.db import models

from app.abstractions.models import AbstractModel
from app.position.models import validate_category, validate_side


class OrderModel(AbstractModel):
    class Meta:
        verbose_name = 'Ордер'
        verbose_name_plural = 'Ордеры'

    position = models.OneToOneField(
        to='position.PositionModel',
        on_delete=models.PROTECT,
        related_name='order',
        verbose_name='Позиция',
    )
    symbol = models.ForeignKey(
        to='setting.SymbolModel',
        on_delete=models.PROTECT,
        verbose_name='Символ',
    )
    uuid = models.UUIDField(
        verbose_name='UUID',
        unique=True,
        default=uuid.uuid4,
        editable=False,
    )
    category = models.CharField(
        verbose_name='Рынок',
        max_length=20,
        validators=[validate_category],
    )
    side = models.CharField(
        verbose_name='Сторона',
        max_length=6,
        validators=[validate_side],
    )
    price = models.CharField(
        verbose_name='Цена',
        max_length=255,
    )
    qty_tokens = models.CharField(
        verbose_name='Кол-во токенов',
        max_length=255,
    )
    is_test = models.BooleanField(
        verbose_name='Тестовая сделка',
    )

    def __str__(self):
        return f'Ордер {self.uuid}'
