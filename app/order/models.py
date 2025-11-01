import json
from typing import List

from django.db import models

from django_fsm import FSMField
from pydantic import ValidationError

from app.abstractions.models import AbstractModel
from app.order.schemas.base import OrderExtremumSchema, OrderExtremumValueSchema
from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server


# -----------------------------------------------------
# Определение статусов ордера.
# -----------------------------------------------------
class OrderStatus(models.TextChoices):
    CREATED = 'created', 'Ожидание подтверждения'   # ордер создан, но еще не принят мониторингом
    ACCEPT_MONITORING = 'monitoring', 'Мониторинг'  # ордер находится под мониторингом
    COMPLETED = 'completed', 'Исполнено'            # ордер успешно завершён
    CANCEL = 'cancel', 'Отменено'                   # ордер отменён

    @classmethod
    def get_open_status_list(cls):
        """
        Возвращает список статусов, при которых ордер считается "открытым".
        Используется, например, для фильтрации активных ордеров.
        """
        return [
            cls.CREATED,
            cls.ACCEPT_MONITORING,
        ]


# -----------------------------------------------------
# Типы зачислений по ордеру — например, комиссия или фандинг.
# -----------------------------------------------------
class OrderCreditingType(models.TextChoices):
    FEE = 'fee', 'Комиссия'
    FUNDING = 'funding', 'Фандинг'


# -----------------------------------------------------
# Валидатор для поля type в OrderCreditingModel.
# Проверяет, что значение входит в список допустимых типов.
# -----------------------------------------------------
def validate_type(value):
    allowed = ['fee', 'funding']
    if value not in allowed:
        raise ValidationError(f"Недопустимый тип: {value}. Допустимые значения: {', '.join(allowed)}")


# -----------------------------------------------------
# Основная модель ордера.
# -----------------------------------------------------
class OrderModel(AbstractModel):
    """
    Модель описывает ордер пользователя на платформе.
    Хранит всю информацию о торговой операции, включая состояние, цену, количество токенов и т.п.
    """

    class Meta:
        verbose_name = 'Ордер'
        verbose_name_plural = 'Ордера'

    # Привязка ордера к конкретной позиции (один ордер — одна позиция)
    position = models.OneToOneField(
        verbose_name='Позиция',
        to='position.PositionModel',
        on_delete=models.CASCADE,
        related_name='order',
    )

    # Уникальный идентификатор ордера (используется и в Redis, и во внешних API)
    uuid = models.CharField(
        verbose_name='UUID',
        max_length=255,
        unique=True,
        default='string'
    )

    # Категория рынка (например, "option", "spot" и т.д.)
    category = models.CharField(
        verbose_name='Рынок',
        max_length=20,
        default='option',
    )

    # Сторона ордера — покупка (buy) или продажа (sell)
    side = models.CharField(
        verbose_name='Сторона',
        max_length=6,
        default='sell'
    )

    # Цена исполнения ордера
    price = models.CharField(
        verbose_name='Цена',
        max_length=255,
        default='100000',
    )

    # Количество токенов, участвующих в ордере
    qty_tokens = models.CharField(
        verbose_name='Кол-во токенов',
        max_length=255,
        default='0.00123'
    )

    # FSMField — поле для управления состояниями ордера.
    # Позволяет использовать переходы между статусами с помощью django-fsm.
    status = FSMField(
        verbose_name='Статус',
        choices=OrderStatus.choices,
        default=OrderStatus.CREATED,
    )

    # Накопленный фандинг — сумма начисленного дохода/расхода по позиции
    accumulated_funding = models.DecimalField(
        verbose_name='Накопленный фандинг',
        decimal_places=18,
        max_digits=40,
        default=0
    )

    # Целевая цена, при достижении которой ордер должен закрыться с прибылью
    target_rate = models.DecimalField(
        verbose_name='Цель для профита',
        decimal_places=18,
        max_digits=40,
        null=True,
        blank=True,
    )

    # Цена, по которой ордер был закрыт (фиксируется при исполнении)
    close_rate = models.DecimalField(
        verbose_name='Курс закрытия',
        decimal_places=18,
        max_digits=40,
        null=True,
        blank=True,
    )

    # Время закрытия ордера
    close_at = models.DateTimeField(
        verbose_name='Время закрытия',
        null=True,
        blank=True,
    )

    # -----------------------------------------------------
    # Метод получения экстремумов (максимума и минимума цены)
    # -----------------------------------------------------
    def get_extremum(self) -> List[OrderExtremumSchema]:
        """
        Извлекает из Redis экстремумы (max и min) для ордера.
        Хранение экстремумов в Redis позволяет быстро получать значения без обращения к БД.
        """
        keys = [
            f"extremum:{self.uuid}:max",
            f"extremum:{self.uuid}:min",
        ]

        # Получаем сразу оба значения из Redis в одном запросе (оптимально)
        values = redis_server.mget(keys, db=RedisDB.extremums)

        result = []
        for k, v in zip(keys, values):
            if v is None:
                # Если данных нет — просто создаём объект с ключом без значения
                result.append(OrderExtremumSchema(key=k))
                continue

            # Redis хранит данные в байтах, поэтому декодируем при необходимости
            v_str = v.decode() if isinstance(v, bytes) else v

            try:
                # Пробуем распарсить строку как JSON и привести к схеме Pydantic
                parsed_value = json.loads(v_str)
                value_schema = OrderExtremumValueSchema(**parsed_value)
            except Exception:
                # Если формат неожиданный (например, просто строка), не падаем
                # и сохраняем значение как есть
                value_schema = OrderExtremumValueSchema(value=v_str, dt="")

            # Формируем итоговую структуру
            result.append(OrderExtremumSchema(key=k, value=value_schema))

        return result


# -----------------------------------------------------
# Модель истории ордера.
# -----------------------------------------------------
class OrderHistoryModel(AbstractModel):
    """
    Хранит изменения, происходящие с ордером — действия пользователя,
    обновления статусов, изменения параметров и комментарии.
    """
    class Meta:
        verbose_name = 'История ордера'
        verbose_name_plural = 'История ордера'

    order = models.ForeignKey(
        verbose_name='Ордер',
        to='order.OrderModel',
        on_delete=models.CASCADE,
        related_name='history',
    )

    # Название действия (например: "создан", "обновлён", "отменён")
    action_name = models.CharField(
        verbose_name='Действие',
        max_length=255,
    )

    # JSON с изменёнными данными, чтобы можно было отследить детали апдейта
    update_data = models.JSONField(
        verbose_name='Данные обновления'
    )

    # Текстовое описание события
    comment = models.TextField(
        verbose_name='Описание'
    )


# -----------------------------------------------------
# Модель зачислений (начислений по ордеру).
# -----------------------------------------------------
class OrderCreditingModel(AbstractModel):
    """
    Описывает операции зачисления по ордеру — например, начисление комиссии (fee)
    или фандинга (funding). Привязана к конкретному ордеру.
    """
    class Meta:
        verbose_name = 'Зачисления'
        verbose_name_plural = 'Зачисления'

    order = models.ForeignKey(
        verbose_name='Ордер',
        to='order.OrderModel',
        on_delete=models.CASCADE,
        related_name='crediting',
    )

    # Тип зачисления (fee / funding)
    type = models.CharField(
        verbose_name='Тип',
        max_length=20,
        choices=OrderCreditingType.choices,
        validators=[validate_type],
    )

    # Количество начисленных единиц (в токенах, USDT и т.д.)
    count = models.DecimalField(
        verbose_name='Кол-во',
        decimal_places=18,
        max_digits=40,
    )

    # Описание причины начисления
    comment = models.TextField(
        verbose_name='Описание'
    )
