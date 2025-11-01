import json

from django.http import HttpRequest

from ninja import Router

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server

router = Router(
    tags=['Ордера'],
)


@router.get(
    path='/extremum',
)
def api_change_status_order(
        request: HttpRequest,
        uuid: str
):
    """
    Получить экстремумы
    """

    _max = f'extremum:order:{uuid}:MAX'
    _min = f'extremum:order:{uuid}:MIN'
    result = redis_server.mget([_max, _min], db=RedisDB.extremums)
    if not result:
        return []

    result = [json.loads(i) if i else None for i in result]
    return result