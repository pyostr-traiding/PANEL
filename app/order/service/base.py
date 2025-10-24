import logging
import uuid
from typing import Union, List

import django
from django.db import transaction

from app.order.models import OrderModel, OrderStatus
from app.order.schemas.base import OrderSchema
from app.position.models import PositionModel, PositionStatus
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq


logger = logging.getLogger(__name__)

def __create_order(
        position: PositionModel,
):
    return None

def __create_order_test(
        position: PositionModel,
) -> Union[OrderModel, response.BaseResponse]:
    try:
        with transaction.atomic():
            if position.status == PositionStatus.COMPLETED:
                return response.OtherErrorResponse(
                    msg=f'Позиция уже в статусе {position.status}'
                )
            position.status = PositionStatus.COMPLETED
            position.save(update_fields=['status'])

            result_create = OrderModel.objects.create(
                position=position,
                uuid=position.uuid,
                category=position.category,
                side=position.side,
                qty_tokens=position.qty_tokens,
                price=position.price,
                status=OrderStatus.CREATED,
            )
        return result_create

    except django.db.utils.IntegrityError as e:
        if 'Duplicate entry' in e.args[1]:
            return response.ConflictResponse(
                msg='Уже создана запись с таким ID'
            )
        logger.exception(f'Неожиданная ошибка базы при создании тестовой позиции: {e}')
        return response.OtherErrorResponse(
            msg=f'Неожиданная ошибка базы',
        )

    except Exception as e:
        logger.exception(f'Ошибка при создании тестовой позиции: {e}')
        return response.OtherErrorResponse(
            msg=f'Неожиданная ошибка при создании ордера',
        )

def create_order(
        position: PositionModel,
):
    """
    Создать новый ордер

    Во время создания статус позиции будет изменен на Исполнен
    """
    if position.is_test:
        order_model = __create_order_test(position=position)
    else:
        order_model = __create_order(position=position)

    if isinstance(order_model, response.BaseResponse):
        return order_model

    message = OrderSchema.model_validate(order_model).model_json_schema()
    if not send_to_rabbitmq(queue='queue_monitoring_order', message=message):
        # Очередь не приняла, но запись уже в базе — можно пометить как failed или удалить
        order_model.delete()
        return response.ConflictResponse(msg='Ошибка отправки в RabbitMQ')

    return OrderSchema.model_validate(order_model)


def get_order(
        uuid: str,
):
    """
    Получить ордер
    """
    order_model = OrderModel.objects.get_or_none(
        uuid=uuid,
    )
    if not order_model:
        return response.NotFoundResponse(msg='Ордер не найден')
    return OrderSchema.model_validate(order_model)


def get_list_open_orders() -> Union[List[OrderSchema], response.BaseResponse]:
    """
    Получить все открытые позиции
    """
    orders_models = OrderModel.objects.filter(
        status__in=OrderStatus.get_open_status_list(),
    )
    if not orders_models:
        return response.NotFoundResponse(msg='Ордеров не найдено')
    return [OrderSchema.model_validate(i) for i in orders_models]