"""
Базовые методы GET/POST
"""
from typing import List, Optional, Literal

from django.db.models import BigIntegerField
from django.db.models.functions import Cast
from django.http import HttpRequest

from ninja import Router, Schema
from pydantic import BaseModel

from app.position.models import PositionModel
from app.position.schemas.base import CreatePositionSchema
from app.position.service.base import (
    create_position,
    get_list_open_position,
    get_position, filter_positions,
)
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq

router = Router(
    tags=['Позиции'],
)

@router.post(
    path='/create',
)
def api_create_position(
        request: HttpRequest,
        data: CreatePositionSchema,
):
    """
    Создать позицию
    Созданная позиция сохраняется в базу и отправляется в очередь RabbitMQ
    Из очереди заявку на позицию обрабатывается сервисом COMMANDER

    Заявка живет в рамках минуты свечи для которой открывается позиция
    После помечается как "Не востребовано" по причине истекшего времени

    Статусы:
    * 200 - Создано
    * 409 - Отклонено, заявка уже создана
    * 406 - Запрещено, время истекло
    """

    result = create_position(
        position_data=data,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    text = (
        f'Создана позиция:\n'
        f'ID: {result.uuid}\n'
        f'Сторона: {result.side}\n'
        f'Сумма: {float(result.price) * float(result.qty_tokens)} USDT\n'
        f'Кол-во: {result.qty_tokens} BTC\n'
        f'Вход: {result.price} USDT'
    )
    send_to_rabbitmq(
        queue='queue_telegram_mailing',
        message={
            "is_test": False,
            "notification": True,
            "text": text,
            "buttons": [{"title": "Открыть", "callback": f"new_pos.{result.uuid}"}]
        }
    )
    return result


@router.get(
    path='/',
)
def api_get_position(
        request: HttpRequest,
        uuid: str,
):
    """
    Получить позицию

    Статусы:
    * 200 - Создано
    * 404 - Не найдено
    """

    result = get_position(
        uuid=uuid,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result


@router.get(
    path='/ListOpen',
)
def api_get_list_open_position(
        request: HttpRequest,
):
    """
    Получить список открытых позиций

    Статусы:
    * 404 - Не найдено
    """

    result = get_list_open_position()
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result


class Range(Schema):
    # Либо список точек client_ms (минутные), либо диапазон start/end
    ms: Optional[List[int]] = None
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None
    symbol: Optional[str] = None

@router.get(
    path='/search',
)
def api_get_positions(
        request: HttpRequest,
        ms: Optional[List[int]] = None,
        start_ms: Optional[List[int]] = None,
        end_ms: Optional[List[int]] = None,
        symbol: Optional[List[str]] = None,
):
    """
    Получить список в диапазоне

    Статусы:
    * 200 - ОК
    * 404 - Не найдено
    """
    qs = PositionModel.objects.all().annotate(
        kline_ms_int=Cast('kline_ms', output_field=BigIntegerField())
    )

    # фильтр по символу, если задан
    if symbol:
        qs = qs.filter(symbol__name=symbol)

    # вариант 1: список точек ms
    if ms:
        qs = qs.filter(kline_ms_int__in=ms)

    # вариант 2: диапазон
    if start_ms is not None and end_ms is not None:
        qs = qs.filter(
            kline_ms_int__gte=start_ms,
            kline_ms_int__lte=end_ms
        )

    data = [
        {
            "uuid": p.uuid,
            "symbol": p.symbol.name,
            "category": p.category,
            "side": p.side,
            "price": p.price,
            "qty_tokens": p.qty_tokens,
            "kline_ms": int(p.kline_ms),  # минутная свеча client_ms
            "status": p.status,
        }
        for p in qs.order_by('-kline_ms_int')[:5000]  # safety-cap
    ]
    return {"results": data}



@router.get(path='/filter')
def api_filter_positions(
        request: HttpRequest,
        status: str = None,
        side: Literal['buy', 'sell'] = None,
        uuid: str = None,
        limit: int = 1,
        offset: int = 0,
):
    """
    Отфильтровать позиции.

    Статусы:
    * 200 — Успешно
    * 409 — Ордер уже закрыт
    * 404 — Ордер не найден
    """
    result = filter_positions(
        status=status,
        side=side,
        uuid=uuid,
        limit=limit,
        offset=offset,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result
