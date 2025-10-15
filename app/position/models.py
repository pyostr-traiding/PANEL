from symtable import Symbol

from django.db import models
from django_fsm import FSMField, transition

from django.core.exceptions import ValidationError

from app.abstractions.models import AbstractModel


class StatusPosition(models.TextChoices):
    CREATED = 'created', 'Создано'
    ACCEPT_MONITORING = 'monitoring', 'Мониторинг'
    CLOSED = 'closed', 'Завершено'


def validate_category(value: str):
    allowed = ['spot', 'option']
    if value.capitalize() not in allowed:
        raise ValidationError(
            f'Недопустимое значение категории "{value}". Разрешено только: {", ".join(allowed)}.'
        )

def validate_side(value: str):
    allowed = ['sell', 'buy']
    if value.capitalize() not in allowed:
        raise ValidationError(
            f'Недопустимое значение категории "{value}". Разрешено только: {", ".join(allowed)}.'
        )

class PositionModel(AbstractModel):
    class Meta:
        verbose_name = 'Позиция'
        verbose_name_plural = 'Позиции'


    symbol = models.ForeignKey(
        verbose_name='Символ',
        to='setting.SymbolModel',
        on_delete=models.PROTECT,
    )
    uuid = models.UUIDField(
        verbose_name='UUID',
        unique=True,
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
    status = FSMField(
        verbose_name='Статус',
        choices=StatusPosition.choices,
        default=StatusPosition.CREATED,
    )
    is_test = models.BooleanField(
        verbose_name='Тест-позиция',
    )

    @transition(field=status, source=StatusPosition.CREATED, target=StatusPosition.ACCEPT_MONITORING)
    def set_status_position_accept_monitoring_service(self):
        pass

    @transition(field=status, source=[StatusPosition.ACCEPT_MONITORING], target=StatusPosition.CLOSED)
    def close(self):
        """
        Завершение позиции
        """
        print(f"Позиция завершена!")

