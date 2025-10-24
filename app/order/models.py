import json
from typing import List

from django_fsm import FSMField

from django.db import models

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
    uuid = models.UUIDField(
        verbose_name='UUID',
        unique=True,
    )
    category = models.CharField(
        verbose_name='Рынок',
        max_length=20,
    )
    side = models.CharField(
        verbose_name='Сторона',
        max_length=6,
    )
    price = models.CharField(
        verbose_name='Цена',
        max_length=255,
    )
    qty_tokens = models.CharField(
        verbose_name='Кол-во токенов',
        max_length=255,
    )
    status = FSMField(
        verbose_name='Статус',
        choices=OrderStatus.choices,
        default=OrderStatus.CREATED,
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

    # def set_extremum(self):
    #     redis_server.set(f'extremum:{self.uuid}:max', json.dumps({'value': '1000', 'dt': '12-12-12 10:10'}), db=RedisDB.orders)
    #     redis_server.set(f'extremum:{self.uuid}:min', json.dumps({'value': '1000', 'dt': '12-12-12 10:10'}), db=RedisDB.orders)
