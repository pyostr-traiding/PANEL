from datetime import datetime, UTC

from django.core.exceptions import ValidationError
from django.db import models

from django_fsm import FSMField

from app.abstractions.models import AbstractModel


class PositionStatus(models.TextChoices):
    CREATED = 'created', 'Создано'
    ACCEPT_MONITORING = 'monitoring', 'Мониторинг'

    COMPLETED = 'completed', 'Исполнено'

    CANCEL = 'cancel', 'Отменено'

    @classmethod
    def get_open_status_list(cls):
        """
        Получить список статусов в которых позиция считается активной
        """
        return [
            cls.CREATED,
            cls.ACCEPT_MONITORING,
        ]

def validate_category(value: str):
    allowed = ['spot', 'option']
    if value.lower() not in allowed:
        raise ValidationError(
            f'Недопустимое значение категории "{value}". Разрешено только: {", ".join(allowed)}.'
        )

def validate_side(value: str):
    allowed = ['sell', 'buy']
    if value.lower() not in allowed:
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
    uuid = models.CharField(
        verbose_name='UUID',
        unique=True,
        max_length=40,
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
        choices=PositionStatus.choices,
        default=PositionStatus.CREATED,
    )
    is_test = models.BooleanField(
        verbose_name='Тест-позиция',
    )
    kline_ms = models.CharField(
        verbose_name='Свеча сигнала',
        max_length=100,
    )
    close_at = models.DateTimeField(
        verbose_name='Время закрытия',
        null=True,
        blank=True,
    )

    def save(
            self,
            *args,
            force_insert=False,
            force_update=False,
            using=None,
            update_fields=None,
    ):
        if not self.close_at and self.status in [
            PositionStatus.CREATED,
            PositionStatus.ACCEPT_MONITORING
        ]:
            self.close_at = None
        elif not self.close_at and self.status in [
            PositionStatus.COMPLETED,
            PositionStatus.CANCEL
        ]:
            self.close_at = datetime.now(UTC)

        self.save_base(
            using=using,
            force_insert=force_insert,
            force_update=force_update,
            update_fields=update_fields,
        )

