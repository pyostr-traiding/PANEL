import logging

from django_fsm import TransitionNotAllowed

from app.utils import response

from app.order.models import OrderModel
from app.order.service.handlers.status_handlers import STATUS_ORDER_HANDLERS

logger = logging.getLogger(__name__)

def change_status_order(data):
    order = OrderModel.objects.get_or_none(uuid=data.uuid)
    if not order:
        return response.NotFoundResponse(msg='Ордер не найден')

    # Статус уже установлен
    if order.status == data.status:
            return response.ConflictResponse(
            msg=f'Ордер уже в статусе {order.status}'
        )

    # Получаем обработчик для нужного статуса
    handler_data = STATUS_ORDER_HANDLERS.get(data.status)
    if not handler_data:
        return response.OtherErrorResponse(msg=f'Нет обработчика для статуса {data.status}')

    # Проверяем допустимость перехода
    allowed_sources = handler_data["source"]
    if order.status not in allowed_sources:
        return response.OtherErrorResponse(
            msg=f"Позиция со статусом '{order.status}' не может перейти в '{data.status}'"
        )

    handler_func = handler_data["handler"]

    try:
        return handler_func(order, data)
    except TransitionNotAllowed as e:
        return response.OtherErrorResponse(msg=str(e))
    except Exception as e:
        logger.error(f'Ошибка смены статуса {e}')
        return response.OtherErrorResponse(msg=f"Ошибка при смене статуса: {e}")
