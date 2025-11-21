from typing import Union, Literal, Optional, List

from django.db.models import BigIntegerField
from django.db.models.functions import Cast
from django.http import HttpRequest

from ninja import Router

from app.order.models import OrderModel
from app.order.schemas.base import CloseOrderSchema, OrderSchema
from app.order.service.base import close_order, get_list_open_orders, get_order, filter_order
from app.position.models import PositionModel
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


@router.get(
    path='/search',
)
def api_get_orders(
        request: HttpRequest,
        start_ms: int = None,
        end_ms: int = None,
):
    """
    Получить список в диапазоне

    Статусы:
    * 200 - ОК
    * 404 - Не найдено
    """

    qs = OrderModel.objects.all().annotate(
        open_kline_ms_int=Cast('open_kline_ms', output_field=BigIntegerField()),
    )

    # вариант 2: диапазон
    if start_ms is not None and end_ms is not None:
        qs = qs.filter(
            open_kline_ms_int__gte=start_ms,
            open_kline_ms_int__lte=end_ms
        )

    data = [
        {
            "uuid": p.uuid,
            "side": p.side,
            "price": p.price,
            "qty_tokens": p.qty_tokens,
            "open_kline_ms": int(p.open_kline_ms),  # минутная свеча client_ms
            "close_kline_ms": int(p.close_kline_ms) if p.close_kline_ms else None,  # минутная свеча client_ms
            "status": p.status,
        }
        for p in qs.order_by('-open_kline_ms_int')[:5000]  # safety-cap
    ]
    return {"results": data}