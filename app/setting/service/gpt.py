from typing import Union, List

from app.setting.models import GPTModel
from app.setting.schemas.gpt import GPTSchema
from app.utils import response


def get_gpt_list() -> Union[List[GPTSchema], response.BaseResponse]:
    result = GPTModel.objects.all()
    if not result:
        return response.NotFoundResponse(
            msg='Моделей нет'
        )
    print(result)
    schema = [GPTSchema.model_validate(i) for i in result]
    return schema