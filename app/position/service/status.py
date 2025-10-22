import logging

from app.position.models import PositionModel
from app.utils import response

from app.position.service.handlers.status_handlers import STATUS_HANDLERS

from django_fsm import TransitionNotAllowed

logger = logging.getLogger(__name__)

def change_status_position(data):
    position = PositionModel.objects.get_or_none(uuid=data.uuid)
    if not position:
        return response.NotFoundResponse(msg='Позиция не найдена')
    if position.status == data.status:
        logger.error(f'Ошибка смены статуса ')
        return response.ConflictResponse(
            msg=f'Позиция уже в статусе {position.status}'
        )
    # Получаем обработчик для нужного статуса
    handler_data = STATUS_HANDLERS.get(data.status)
    if not handler_data:
        return response.OtherErrorResponse(msg=f'Нет обработчика для статуса {data.status}')

    # Проверяем допустимость перехода
    allowed_sources = handler_data["source"]
    if position.status not in allowed_sources:
        return response.OtherErrorResponse(
            msg=f"Позиция со статусом '{position.status}' не может перейти в '{data.status}'"
        )

    handler_func = handler_data["handler"]

    try:
        return handler_func(position, data)
    except TransitionNotAllowed as e:
        return response.OtherErrorResponse(msg=str(e))
    except Exception as e:
        logger.error(f'Ошибка смены статуса {e}')
        return response.OtherErrorResponse(msg=f"Ошибка при смене статуса: {e}")
