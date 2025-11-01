"""
Методы для управления позицией
"""
from django.http import HttpRequest

from ninja import Router

from app.order.schemas.status import ChangeOrderStatusSchema
from app.order.service.funding import accumulate_funding
from app.order.service.status import change_status_order
from app.utils import response

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


@router.post(
    path='/accumulateFunding',
)
def api_accumulate_funding(
        request: HttpRequest,
):
    """
    Начислить фандинг на все открытые ордера
    """

    result = accumulate_funding()
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)

    return result