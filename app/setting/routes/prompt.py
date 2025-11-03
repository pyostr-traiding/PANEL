from typing import Union

from django.http import HttpRequest

from ninja import Router

from app.utils import response

from app.setting.schemas.prompt import PromptSchema
from app.setting.service.prompt import get_prompt

router = Router(
    tags=['Настройки'],
)


@router.get(path='/')
def api_get_prompt(
        request: HttpRequest,
        code: str,
) -> Union[PromptSchema, response.BaseResponse]:
    """
    Получить промпт.

    Статусы:
    * 200 — Успешно
    * 404 — Ордер не найден
    """
    result = get_prompt(code=code)
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result
