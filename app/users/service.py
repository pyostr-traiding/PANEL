from django.db import transaction

from app.users.models import BotPermissionModel, TelegramUserModel
from app.users.schema import (
    BalanceTgUserSchema,
    CreateTGUserSchema,
    GetBalanceTgUserSchema,
    PermissionsSchema,
    TGUserSchema,
)


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
