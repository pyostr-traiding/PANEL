import logging
from datetime import datetime
from typing import List, Union

import django
from django.db import transaction

from app.order.models import OrderModel, OrderStatus
from app.order.schemas.base import CloseOrderSchema, OrderSchema
from app.position.models import PositionModel, PositionStatus
from app.position.schemas.status import ChangeStatusSchema
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq

logger = logging.getLogger(__name__)


def __create_order(position: PositionModel):
    """
    Создание реального ордера (не тестового).
    Пока не реализовано — функция-заглушка.
    """
    return None


def __create_order_test(position: PositionModel, data: ChangeStatusSchema) -> Union[OrderModel, response.BaseResponse]:
    """
    Создание тестового ордера. Используется для тестовых позиций.
    """
    try:
        with transaction.atomic():
            # Проверяем, не завершена ли уже позиция
            if position.status == PositionStatus.COMPLETED:
                return response.OtherErrorResponse(
                    msg=f'Позиция уже в статусе {position.status}'
                )

            # Обновляем статус позиции и сохраняем
            position.status = PositionStatus.COMPLETED
            position.kline_ms = data.kline_ms
            position.save(update_fields=['status', 'kline_ms'])

            # Создаём ордер на основе данных позиции
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

    # Обрабатываем конфликт при создании дубля
    except django.db.utils.IntegrityError as e:
        if 'Duplicate entry' in e.args[1]:
            return response.ConflictResponse(msg='Уже создана запись с таким ID')
        logger.exception(f'Ошибка базы при создании тестового ордера: {e}')
        return response.OtherErrorResponse(msg='Ошибка базы при создании ордера')

    except Exception as e:
        logger.exception(f'Ошибка при создании тестового ордера: {e}')
        return response.OtherErrorResponse(msg='Неожиданная ошибка при создании ордера')


# ------------------------------------------------------
# Основная логика
# ------------------------------------------------------

def create_order(position: PositionModel, data: ChangeStatusSchema):
    """
    Создаёт новый ордер.
    Если позиция тестовая — используется __create_order_test.
    При успешном создании отправляет сообщение в RabbitMQ.
    """
    if position.is_test:
        order_model = __create_order_test(position=position, data=data)
    else:
        order_model = __create_order(position=position)

    if isinstance(order_model, response.BaseResponse):
        return order_model

    # Конвертируем ORM объект в JSON и отправляем в очередь
    message = OrderSchema.model_validate(order_model).model_dump_json()
    if not send_to_rabbitmq(queue='queue_monitoring_order', message=message):
        # Если сообщение не отправилось — удаляем запись
        order_model.delete()
        return response.ConflictResponse(msg='Ошибка отправки в RabbitMQ')

    return OrderSchema.model_validate(order_model)


def get_order(uuid: str):
    """
    Получить ордер по UUID.
    Возвращает схему Pydantic или ошибку.
    """
    order_model = OrderModel.objects.get_or_none(uuid=uuid)
    if not order_model:
        return response.NotFoundResponse(msg='Ордер не найден')

    schema = OrderSchema.model_validate(order_model)
    schema.status_title = order_model.get_status_display().upper()
    return schema


def get_list_open_orders() -> Union[List[OrderSchema], response.BaseResponse]:
    """
    Получить все открытые ордера (в статусах CREATED или MONITORING).
    """
    orders_models = OrderModel.objects.filter(status__in=OrderStatus.get_open_status_list())
    if not orders_models:
        return response.NotFoundResponse(msg='Ордеров не найдено')

    return [OrderSchema.model_validate(i) for i in orders_models]


def close_order(data: CloseOrderSchema) -> Union[OrderSchema, response.BaseResponse]:
    """
    Закрыть ордер.
    Проверяет статус, обновляет курс и дату закрытия.
    """
    order_model: OrderModel = OrderModel.objects.get_or_none(uuid=data.uuid)
    if not order_model:
        return response.NotFoundResponse(msg='Ордер не найден')

    # Разрешаем закрывать только ордера в статусе мониторинга
    if order_model.status not in [OrderStatus.ACCEPT_MONITORING]:
        return response.OtherErrorResponse(msg='Ордер должен быть в статусе MONITORING')

    # Обновляем статус и сохраняем
    order_model.status = OrderStatus.COMPLETED
    order_model.close_rate = data.rate
    order_model.close_at = datetime.now()
    order_model.save(update_fields=['status', 'close_rate', 'close_at'])

    return OrderSchema.model_validate(order_model)
