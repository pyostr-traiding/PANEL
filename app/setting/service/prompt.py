from typing import Union

from app.setting.models import PromptModel
from app.setting.schemas.prompt import PromptSchema
from app.utils import response


def get_prompt(
        code: str,
) -> Union[PromptSchema, response.BaseResponse]:
    """
    Получит промпт
    """
    prompt = PromptModel.objects.get_or_none(code=code)
    if not prompt:
        return response.NotFoundResponse(
            msg='Промпта не найдено'
        )
    return PromptSchema.model_validate(prompt)