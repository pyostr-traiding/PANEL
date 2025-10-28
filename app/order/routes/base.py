from typing import Union

from django.http import HttpRequest
from ninja import Router

from app.order.schemas.base import OrderSchema, CloseOrderSchema
from app.order.service.base import get_order, get_list_open_orders, close_order
from app.utils import response


router = Router(
    tags=['Ордера'],
)


@router.get(
    path='/',
)
def api_get_order(
        request: HttpRequest,
        uuid: str,
) -> Union[OrderSchema, response.BaseResponse]:
    """
    Получить ордер

    Статусы:
    * 200 - Создано
    * 404 - Не найдено
    """

    result = get_order(
        uuid=uuid,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result




@router.get(
    path='/ListOpen',
)
def api_get_list_open_orders(
        request: HttpRequest,
):
    """
    Получить список открытых ордеров

    Статусы:
    * 404 - Не найдено
    """

    result = get_list_open_orders()
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result


@router.post(
    path='/close',
)
def api_close_orders(
        request: HttpRequest,
        data: CloseOrderSchema
):
    """
    Закрыть ордер

    Статусы:
    * 200 - Успешно
    * 409 - Ордер уше закрыт
    * 404 - Не найдено
    """

    result = close_order(data=data)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result