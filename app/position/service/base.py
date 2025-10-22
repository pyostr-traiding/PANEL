import json
from decimal import Decimal

import django
import pika

from typing import Union, List

from django.db import transaction

from app.position.models import PositionModel, PositionStatus
from app.position.schemas.base import CreatePositionSchema, PositionSchema
from app.setting.models import SymbolModel
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq


def get_position_qty(
        symbol: SymbolModel,
        position_data: CreatePositionSchema,
):
    """
    Получить сумму для сделки
    """
    qty =   Decimal(symbol.qty_USDT_for_order) / Decimal(position_data.price)
    return str(qty)

def create_position(
        position_data: CreatePositionSchema,
):
    """
    Создать новую позицию
    """
    try:
        with transaction.atomic():
            symbol = SymbolModel.objects.get(name=position_data.symbol_name)
            qty_tokens = get_position_qty(symbol=symbol, position_data=position_data)
            result_create = PositionModel.objects.create(
                symbol=symbol,
                uuid=position_data.uuid,
                category=position_data.category,
                side=position_data.side,
                qty_tokens=qty_tokens,
                price=position_data.price,
                is_test=position_data.is_test,
            )
    except django.db.utils.IntegrityError as e:
        if 'Duplicate entry' in e.args[1]:
            return response.ConflictResponse(
                msg='Уже создана запись с таким ID'
            )
        raise e

    # Здесь транзакция уже коммитнулась, запись точно в базе
    message = PositionSchema(**result_create.__dict__).model_dump()
    if not send_to_rabbitmq(queue='queue_new_position', message=message):
        # Очередь не приняла, но запись уже в базе — можно пометить как failed или удалить
        result_create.delete()
        return response.ConflictResponse(msg='Ошибка отправки в RabbitMQ')

    return PositionSchema(**result_create.__dict__)


def get_position(
        uuid: str,
):
    """
    Получить позицию
    """
    position_model = PositionModel.objects.get_or_none(
        uuid=uuid,
    )
    if not position_model:
        return response.NotFoundResponse(msg='Позиция не найдена')
    return PositionSchema.model_validate(position_model)


def get_list_open_position() -> Union[List[PositionSchema], response.BaseResponse]:
    """
    Получить все открытые позиции
    """
    positions_models = PositionModel.objects.filter(
        status__in=PositionStatus.get_open_status_list(),
    )
    if not positions_models:
        return response.NotFoundResponse(msg='Позиций не найдено')
    return [PositionSchema.model_validate(i) for i in positions_models]