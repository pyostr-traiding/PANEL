from ninja import Router

from django.http import JsonResponse, HttpRequest

from app.users.schema import TGUserSchema, GetBalanceTgUserSchema, CreateTGUserSchema
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

