from django.db import models

from app.abstractions.models import AbstractModel


class TelegramUserModel(AbstractModel):
    """
    Телеграм пользователь
    """
    class Meta:
        verbose_name = 'Телеграм'
        verbose_name_plural = 'Телеграм'

    chat_id = models.CharField(
        verbose_name='ID',
        max_length=70,
        unique=True,
    )
    username = models.CharField(
        verbose_name='Ник',
        max_length=255,
        null=True,
        blank=True,
    )
    balance = models.PositiveIntegerField(
        verbose_name='Баланс запросов',
        default=2,
    )

    is_trader = models.BooleanField(
        verbose_name='Статус трейдера',
        default=False,
        help_text='Имеет полный доступ к боту'
    )


class BotPermissionModel(AbstractModel):
    """
    Права доступа к боту
    """
    class Meta:
        verbose_name = 'Доступы к боту'
        verbose_name_plural = 'Доступы к боту'

    user = models.OneToOneField(
        verbose_name='Пользователь',
        to='users.TelegramUserModel',
        on_delete=models.CASCADE,
    )

    main_menu = models.BooleanField(
        verbose_name='Главное меню',
        default=False,
    )

    glaz_menu = models.BooleanField(
        verbose_name='Глаз бога',
        default=False,
    )

    receipt_menu = models.BooleanField(
        verbose_name='Чеки',
        default=False,
    )

