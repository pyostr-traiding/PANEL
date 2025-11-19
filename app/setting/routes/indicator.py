from typing import Union, List

from django.http import HttpRequest

from ninja import Router

from app.setting.schemas.indicator import IndicatorSchema
from app.setting.service.indicator import get_indicator, update_indicator, get_indicator_list
from app.utils import response

from app.setting.schemas.prompt import PromptSchema
from app.setting.service.prompt import get_prompt

router = Router(
    tags=['Настройки'],
)


@router.get(path='/indicator/')
def api_get_indicator(
        request: HttpRequest,
        name: str,
) -> Union[IndicatorSchema, response.BaseResponse]:
    """
    Получить настройку индикатора

    Статусы:
    * 200 — Успешно
    """
    result = get_indicator(name=name)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result

@router.get(path='/indicator/list')
def api_get_indicator_list(
        request: HttpRequest,
) -> Union[List[IndicatorSchema], response.BaseResponse]:
    """
    Получить список всех индикаторов

    Статусы:
    * 200 — Успешно
    """
    result = get_indicator_list()
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result

@router.put(path='/indicator/')
def api_update_indicator(
        request: HttpRequest,
        data: IndicatorSchema,
) -> Union[IndicatorSchema, response.BaseResponse]:
    """
    Обновить настройку индикатора

    Статусы:
    * 200 — Успешно
    """
    result = update_indicator(data=data)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result
