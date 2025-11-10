from typing import Union

from django.http import HttpRequest

from ninja import Router

from app.utils import response
from app.setting.schemas.exchange import ExchangeSchema
from app.setting.service.exchange import get_exchange

router = Router(
    tags=['Настройки'],
)


@router.get(path='/exchange')
def api_get_exchange(
        request: HttpRequest,
        name: str,
) -> Union[ExchangeSchema, response.BaseResponse]:
    """
    Получить настройки биржи.

    Статусы:
    * 200 — Успешно
    * 404 — Ордер не найден
    """
    result = get_exchange(name=name)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result
