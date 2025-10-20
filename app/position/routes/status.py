"""
Методы для управления позицией
"""
from django.http import HttpRequest
from ninja import Router

from app.utils import response
from app.position.schemas.status import ChangeStatusSchema
from app.position.service.status import change_status_position

router = Router(
    tags=['Позиции'],
)


@router.post(
    path='/changeStatus',
)
def api_change_status_position(
        request: HttpRequest,
        data: ChangeStatusSchema,
):
    """
    Смена статуса позиции

    Статусы:
    *200 - Создано
    *409 - Отклонено, заявка уже создана
    *406 - Запрещено, время истекло
    """

    result = change_status_position(
        data=data,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)

    return result