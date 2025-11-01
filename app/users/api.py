from django.http import HttpRequest, JsonResponse

from ninja import Router

from app.users.schema import CreateTGUserSchema, GetBalanceTgUserSchema, TGUserSchema
from app.users.service import get_or_create_tg_user, tg_user_balance

router = Router(
    tags=['Пользователи'],
)


@router.post(
    path="/GetOrCreate",
)
def api_get_or_create_tg_user(
        request: HttpRequest,
        data: CreateTGUserSchema,
):
    """
    Создать ТГ пользователя
    """
    result = get_or_create_tg_user(data=data)
    return JsonResponse(
        status=200,
        data=result.model_dump()
    )

@router.post(
    path="/balance",
)
def api_get_balance(
        request: HttpRequest,
        data: GetBalanceTgUserSchema,
):
    """
    Баланс пользователя

    Если decries = True списывается 1 запрос
    """
    result = tg_user_balance(data=data)
    return JsonResponse(
        status=200,
        data=result.model_dump()
    )

