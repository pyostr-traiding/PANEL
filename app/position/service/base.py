import json
from decimal import Decimal
from typing import List, Union, Literal

import django
from django.db import transaction

import pika
from django.db.models import Case, When, Value, IntegerField

from app.order.models import OrderModel, OrderStatus
from app.position.models import PositionModel, PositionStatus
from app.position.schemas.base import CreatePositionSchema, PositionSchema, PositionFilterResponseSchema
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
    check_open_order = OrderModel.objects.filter(
        status__in=[OrderStatus.CREATED, OrderStatus.ACCEPT_MONITORING]
    )
    check_open_position = PositionModel.objects.filter(
        status__in=[PositionStatus.CREATED, PositionStatus.ACCEPT_MONITORING]
    )
    if check_open_order.exists() or check_open_position.exists():
        return response.OtherErrorResponse(
            msg='Нельзя иметь более 1 ордера'
        )
    try:
        with transaction.atomic():
            symbol = SymbolModel.objects.get(name=position_data.symbol_name)
            qty_tokens = get_position_qty(symbol=symbol, position_data=position_data)
            result_create = PositionModel.objects.create(
                kline_ms=position_data.kline_ms,
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
    message = PositionSchema.model_validate(result_create).model_dump_json()
    if not send_to_rabbitmq(queue='queue_monitoring_position', message=message):
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



def filter_positions(
        status: str = None,
        side: Literal['buy', 'sell'] = None,
        uuid: str = None,
        limit: int = 1,
        offset: int = 0,
) -> Union[PositionFilterResponseSchema, response.BaseResponse]:
    """"""
    filters = {}
    if status is not None:
        filters["status"] = status
    if side is not None:
        filters["side"] = side
    if uuid is not None:
        filters["uuid"] = uuid

    # Фильтруем базовый queryset
    result = PositionModel.objects.filter(**filters)

    # Сортировка: сначала created/monitoring, потом остальные, внутри — по убыванию даты создания
    result = result.annotate(
        status_position=Case(
            When(status__in=['create', 'monitoring'], then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
    ).order_by('status_position', '-created_at')  # предполагается, что есть поле created_at

    count_orders = PositionModel.objects.count()
    result = result[offset:offset + limit]

    if not result:
        return response.NotFoundResponse(msg='Нечего не найдено')

    positions = []
    for i in result:
        schema = PositionSchema.model_validate(i)
        schema.status_title = i.get_status_display().upper()
        positions.append(schema)

    return PositionFilterResponseSchema(
        positions=positions,
        count_db=count_orders,
    )