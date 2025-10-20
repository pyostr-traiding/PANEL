# app/position/service/status.py

from app.position.models import PositionModel
from app.position.schemas.base import PositionSchema
from app.position.service.status_handlers import STATUS_HANDLERS
from app.utils import response

# Импортируем обработчики для регистрации в STATUS_HANDLERS
from app.position.service.handlers import (  # noqa: F401
    accept_monitoring,
    cancel,
    completed,
)

from django_fsm import TransitionNotAllowed


def change_status_position(data):
    position = PositionModel.objects.get_or_none(uuid=data.uuid)
    if not position:
        return response.NotFoundResponse(msg='Позиция не найдена')

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
        result = handler_func(position, data)
        if isinstance(result, response.BaseResponse):
            return result

        if isinstance(result, PositionModel):
            return PositionSchema(**result.__dict__)

        return result
    except TransitionNotAllowed as e:
        return response.OtherErrorResponse(msg=str(e))
    except Exception as e:
        return response.OtherErrorResponse(msg=f"Ошибка при смене статуса: {e}")
