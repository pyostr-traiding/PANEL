from django.http import HttpRequest

from ninja import Router

from app.order.schemas.status import ChangeOrderStatusSchema
from app.order.service.status import change_status_order
from app.utils import response

router = Router(
    tags=['Ордера'],
)


@router.post(
    path='/crediting',
)
def api_add_crediting(
        request: HttpRequest,
        data: ChangeOrderStatusSchema,
):
    """
    Добавить начисление

    Статусы:
    * 200 - Записано
    """

    result = change_status_order(
        data=data,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)

    return result