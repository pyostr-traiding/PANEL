from typing import Union, List

from django.http import HttpRequest

from ninja import Router

from app.setting.schemas.gpt import GPTSchema
from app.setting.schemas.indicator import IndicatorSchema
from app.setting.service.gpt import get_gpt_list
from app.setting.service.indicator import get_indicator, update_indicator, get_indicator_list
from app.utils import response

from app.setting.schemas.prompt import PromptSchema
from app.setting.service.prompt import get_prompt

router = Router(
    tags=['Настройки'],
)


@router.get(path='/gpt/list')
def api_get_gpt_list(
        request: HttpRequest,
) -> Union[List[GPTSchema], response.BaseResponse]:
    """
    Получить список всех моделей

    """
    result = get_gpt_list()
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result
