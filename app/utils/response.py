from typing import Any, Optional

from django.http import JsonResponse
from pydantic import BaseModel


class BaseResponse(BaseModel):
    status: bool
    data: Optional[Any] = None
    msg: Optional[str] = None

class RequestErrorResponse(BaseResponse):
    """
    Блокировка создания
    """
    status: bool = False

class BanTimeoutResponse(BaseResponse):
    """
    Запрещено, блокировка на некоторое-время
    """
    status: bool = False

class BanResponse(BaseResponse):
    """
    Блокировка создания
    """
    status: bool = False

class NotFoundResponse(BaseResponse):
    """
    Не найдено
    """
    status: bool = False


class ConflictResponse(BaseResponse):
    """
    409 ошибка
    """
    status: bool = False

class OtherErrorResponse(BaseResponse):
    """
    Странная/другая ошибка
    """
    status: bool = False

def return_response(schema: BaseResponse):
    # TODO: определить коды
    if isinstance(schema, ConflictResponse):
        return JsonResponse(
            status=409,
            data=schema.model_dump(),
        )
    if isinstance(schema, OtherErrorResponse):
        return JsonResponse(
            status=424,
            data=schema.model_dump(),
        )
    if isinstance(schema, NotFoundResponse):
        return JsonResponse(
            status=404,
            data=schema.model_dump(),
        )
    if isinstance(schema, BanResponse):
        return JsonResponse(
            status=406,
            data=schema.model_dump(),
        )

    return JsonResponse(
        status=500,
        data=schema.model_dump(),
    )