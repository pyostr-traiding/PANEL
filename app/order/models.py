import json
from decimal import Decimal, getcontext, InvalidOperation
from typing import List

from django_fsm import FSMField

from django.db import models
from pydantic import ValidationError

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.abstractions.models import AbstractModel
from app.order.schemas.base import OrderExtremumSchema, OrderExtremumValueSchema


class OrderStatus(models.TextChoices):
    CREATED = 'created', 'Ожидание подтверждения'
    ACCEPT_MONITORING = 'monitoring', 'Мониторинг'

    COMPLETED = 'completed', 'Исполнено'

    CANCEL = 'cancel', 'Отменено'

    @classmethod
    def get_open_status_list(cls):
        return [
            cls.CREATED,
            cls.ACCEPT_MONITORING,
        ]


def _to_decimal(value: str, name: str) -> Decimal:
    if isinstance(value, Decimal):
        return value
    try:
        # чистим пробелы, заменяем запятую на точку на всякий случай
        s = str(value).strip().replace(',', '.')
        return Decimal(s)
    except (InvalidOperation, ValueError):
        raise ValueError(f"{name} должно быть числом, получено: {value!r}")


class OrderModel(AbstractModel):
    class Meta:
        verbose_name = 'Ордер'
        verbose_name_plural = 'Ордера'

    position = models.OneToOneField(
        verbose_name='Позиция',
        to='position.PositionModel',
        on_delete=models.CASCADE,
        related_name='order',
    )

    uuid = models.CharField(
        verbose_name='UUID',
        max_length=255,
        unique=True,
        default='string'
    )

    category = models.CharField(
        verbose_name='Рынок',
        max_length=20,
        default='option',
    )

    side = models.CharField(
        verbose_name='Сторона',
        max_length=6,
        default='sell'
    )

    price = models.CharField(
        verbose_name='Цена',
        max_length=255,
        default='100000',
    )

    qty_tokens = models.CharField(
        verbose_name='Кол-во токенов',
        max_length=255,
        default='0.00123'
    )

    status = FSMField(
        verbose_name='Статус',
        choices=OrderStatus.choices,
        default=OrderStatus.CREATED,
    )

    accumulated_funding = models.DecimalField(
        verbose_name='Накопленный фандинг',
        decimal_places=18,
        max_digits=40,
        default=0
    )

    target_rate = models.DecimalField(
        verbose_name='Цель для профита',
        decimal_places=18,
        max_digits=40,
        null=True,
        blank=True,
    )

    close_rate = models.DecimalField(
        verbose_name='Курс закрытия',
        decimal_places=18,
        max_digits=40,
        null=True,
        blank=True,
    )

    def get_extremum(self) -> List[OrderExtremumSchema]:
        """
        Получить экстремумы max/min для ордера.
        """
        keys = [
            f"extremum:{self.uuid}:max",
            f"extremum:{self.uuid}:min",
        ]

        values = redis_server.mget(keys, db=RedisDB.extremums)

        result = []
        for k, v in zip(keys, values):
            if v is None:
                result.append(OrderExtremumSchema(key=k))
                continue

            # безопасное декодирование
            v_str = v.decode() if isinstance(v, bytes) else v

            try:
                parsed_value = json.loads(v_str)
                value_schema = OrderExtremumValueSchema(**parsed_value)
            except Exception:
                # если в Redis не JSON — просто сохраним как строку
                value_schema = OrderExtremumValueSchema(value=v_str, dt="")

            result.append(OrderExtremumSchema(key=k, value=value_schema))

        return result

    def target_price_for_profit(self, profit_percent: float | str | Decimal) -> Decimal:
        """
        Возвращает цену, при которой ЧИСТАЯ прибыль составит profit_percent %
        от стоимости позиции (в долларах), с учётом accumulated_funding (тоже в $).
        """
        price = _to_decimal(self.price, "price")
        qty = _to_decimal(self.qty_tokens, "qty_tokens")
        fees_usd = _to_decimal(self.accumulated_funding, "accumulated_funding")
        p = _to_decimal(profit_percent, "profit_percent")

        # Текущая стоимость позиции в долларах
        position_value_usd = price * qty

        # Желаемая прибыль в долларах
        desired_profit_usd = position_value_usd * (p / Decimal(100))

        # Целевая цена (лонг или шорт)
        if self.side.lower() == "sell":
            target_price = price - (desired_profit_usd + fees_usd) / qty
        else:
            target_price = price + (desired_profit_usd + fees_usd) / qty

        return target_price
class OrderHistoryModel(AbstractModel):
    class Meta:
        verbose_name = 'История ордера'
        verbose_name_plural = 'История ордера'

    order = models.ForeignKey(
        verbose_name='Ордер',
        to='order.OrderModel',
        on_delete=models.CASCADE,
        related_name='history',
    )

    action_name = models.CharField(
        verbose_name='Действие',
        max_length=255,
    )

    update_data = models.JSONField(
        verbose_name='Данные обновления'
    )

    comment = models.TextField(
        verbose_name='Описание'
    )

class OrderCreditingType(models.TextChoices):
    FEE = 'fee', 'Комиссия'
    FUNDING = 'funding', 'Фандинг'

def validate_type(value):
    allowed = ['fee', 'funding']
    if value not in allowed:
        raise ValidationError(f"Недопустимый тип: {value}. Допустимые значения: {', '.join(allowed)}")


class OrderCreditingModel(AbstractModel):
    class Meta:
        verbose_name = 'Зачисления'
        verbose_name_plural = 'Зачисления'

    order = models.ForeignKey(
        verbose_name='Ордер',
        to='order.OrderModel',
        on_delete=models.CASCADE,
        related_name='crediting',
    )

    type = models.CharField(
        verbose_name='Тип',
        max_length=20,
        choices=OrderCreditingType.choices,
        validators=[validate_type],

    )

    count = models.DecimalField(
        verbose_name='Кол-во',
        decimal_places=18,
        max_digits=40,
    )

    comment = models.TextField(
        verbose_name='Описание'
    )
