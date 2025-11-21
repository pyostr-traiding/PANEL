from django.db import transaction
from pyasn1_modules.rfc3279 import ppBasis

from app.users.models import BotPermissionModel, TelegramUserModel
from app.users.schema import (
    BalanceTgUserSchema,
    CreateTGUserSchema,
    GetBalanceTgUserSchema,
    PermissionsSchema,
    TGUserSchema,
)
from app.utils import response


def get_or_create_tg_user(
        data: CreateTGUserSchema,
) -> TGUserSchema:
    """
    Получить или создать пользователя вместе с правами
    """
    try:
        # Пробуем сразу выбрать с правами
        obj = TelegramUserModel.objects.select_related('botpermissionmodel').get(chat_id=data.chat_id)
        # Обновляем username если изменился
        if data.username and obj.username != data.username:
            obj.username = data.username
            obj.save(update_fields=['username'])
    except TelegramUserModel.DoesNotExist:
        # Создаём всё в одной транзакции
        with transaction.atomic():
            obj = TelegramUserModel.objects.create(
                chat_id=data.chat_id,
                username=data.username
            )
            permissions_obj = BotPermissionModel.objects.create(user=obj)
    else:
        # если права нет — создаём один раз
        if not hasattr(obj, 'botpermissionmodel'):
            permissions_obj = BotPermissionModel.objects.create(user=obj)
        else:
            permissions_obj = obj.botpermissionmodel

    permissions = PermissionsSchema(
        main_menu=permissions_obj.main_menu,
        glaz_menu=permissions_obj.glaz_menu,
        receipt_menu=permissions_obj.receipt_menu,
    )

    return TGUserSchema(
        chat_id=obj.chat_id,
        username=obj.username,
        balance=obj.balance,
        is_trader=obj.is_trader,
        permissions=permissions
    )


def tg_user_balance(
        data: GetBalanceTgUserSchema,
):
    """
    Баланс пользователя
    """
    user = TelegramUserModel.objects.get(
        chat_id=data.chat_id,
    )
    if data.decries:
        user.balance = user.balance - 1
        user.save()
    return BalanceTgUserSchema(**user.__dict__)


def add_permissions(
        username: str
):
    """
    Баланс пользователя
    """
    username = username.replace('@', '')
    user = TelegramUserModel.objects.get_or_none(
        username=username,
    )
    if not user:
        return response.NotFoundResponse(msg='Пользователь не найден')
    permissions_obj = BotPermissionModel.objects.get(user=user)
    permissions_obj.receipt_menu = True
    permissions_obj.save()
    permissions = PermissionsSchema(
        main_menu=permissions_obj.main_menu,
        glaz_menu=permissions_obj.glaz_menu,
        receipt_menu=permissions_obj.receipt_menu,
    )
    return TGUserSchema(
        chat_id=user.chat_id,
        username=user.username,
        balance=user.balance,
        is_trader=user.is_trader,
        permissions=permissions
    )