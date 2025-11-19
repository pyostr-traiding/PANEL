from typing import Literal

from django.http import HttpRequest

from ninja import Router

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.utils import response

router = Router(
    tags=['Фронтенд'],
)


@router.get(
    path='/monitoring/',
)
def api_get_monitoring(
        request: HttpRequest,
        key: Literal['order', 'position'],
):
    """
    Возвращает список данных
    """
    all_keys = []
    cursor = 0
    pattern = f"{key}*"

    while True:
        cursor, keys = redis_server.scan(
            cursor=cursor,
            match=pattern,
            count=1000,
            db=RedisDB.monitoring
        )
        all_keys.extend(keys)
        if cursor == 0:
            break

    if not all_keys:
        return response.return_response(response.NotFoundResponse(
            msg='Пуфто'
        ))

    # получаем данные по ключам
    result = []
    for k in all_keys:
        value = redis_server.get(k, db=RedisDB.monitoring)
        result.append({
            "key": k,
            "value": value,
        })

    return result


@router.delete(
    path='/monitoring/delete',
)
def api_delete_monitoring(
        request: HttpRequest,
        key: str,
):
    """
    Удалить значение
    """
    result = redis_server.delete(
        key=key,
        db=RedisDB.monitoring
    )
    return result