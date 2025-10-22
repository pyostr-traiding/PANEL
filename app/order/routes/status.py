"""
Методы для управления позицией
"""
from django.http import HttpRequest
from ninja import Router

from app.utils import response
from app.order.schemas.status import ChangeOrderStatusSchema
from app.order.service.status import change_status_order

router = Router(
    tags=['Ордера'],
)


@router.post(
    path='/changeStatus',
)
def api_change_status_order(
        request: HttpRequest,
        data: ChangeOrderStatusSchema,
):
    """
    Смена статуса ордера

    Статусы:
    * 200 - Записано
    """

    result = change_status_order(
        data=data,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)

    return result