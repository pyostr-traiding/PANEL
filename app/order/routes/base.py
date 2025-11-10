from typing import Union, Literal

from django.http import HttpRequest

from ninja import Router

from app.order.schemas.base import CloseOrderSchema, OrderSchema
from app.order.service.base import close_order, get_list_open_orders, get_order, filter_order
from app.utils import response

# Роутер для эндпоинтов ордеров
router = Router(
    tags=['Ордера'],
)


@router.get(path='/')
def api_get_order(
        request: HttpRequest,
        uuid: str,
) -> Union[OrderSchema, response.BaseResponse]:
    """
    Получить конкретный ордер по UUID.

    Статусы:
    * 200 — Успешно
    * 404 — Ордер не найден
    """
    result = get_order(uuid=uuid)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result


@router.get(path='/ListOpen')
def api_get_list_open_orders(
        request: HttpRequest,
):
    """
    Получить список открытых ордеров.

    Статусы:
    * 404 — Ордеров не найдено
    """
    result = get_list_open_orders()
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result


@router.post(path='/close')
def api_close_orders(
        request: HttpRequest,
        data: CloseOrderSchema
):
    """
    Закрыть ордер.

    Статусы:
    * 200 — Успешно
    * 409 — Ордер уже закрыт
    * 404 — Ордер не найден
    """
    result = close_order(data=data)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result


@router.get(path='/filter')
def api_filter_orders(
        request: HttpRequest,
        status: str = None,
        side: Literal['buy', 'sell'] = None,
        uuid: str = None,
        limit: int = 1,
        offset: int = 0,
):
    """
    Отфильтровать ордера.

    Статусы:
    * 200 — Успешно
    * 409 — Ордер уже закрыт
    * 404 — Ордер не найден
    """
    result = filter_order(
        status=status,
        side=side,
        uuid=uuid,
        limit=limit,
        offset=offset,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result
