from typing import Union

from app.setting.models import ExchangeModel
from app.setting.schemas.exchange import ExchangeSchema
from app.utils import response


def get_exchange(
        name: str,
) -> Union[ExchangeSchema, response.BaseResponse]:
    """
    Получит промпт
    """
    exchange = ExchangeModel.objects.get_or_none(name=name)
    if not exchange:
        return response.NotFoundResponse(
            msg='Биржи не найдено не найдено'
        )
    return ExchangeSchema.model_validate(exchange)