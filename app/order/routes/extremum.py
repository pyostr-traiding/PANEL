import json

from django.http import HttpRequest

from ninja import Router

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server

router = Router(
    tags=['Ордера'],
)


@router.get(
    path='/extremum/batch',
)
def api_change_status_order(
        request: HttpRequest,
        uuids: str
):
    """
    Получить экстремумы пачкой:
    /extremum/batch?uuids=uuid1,uuid2,uuid3
    """
    id_list = uuids.split(",")

    keys = []
    for uid in id_list:
        keys.append(f'extremum:order:{uid}:MAX')
        keys.append(f'extremum:order:{uid}:MIN')

    # mget одним пакетом
    result = redis_server.mget(keys, db=RedisDB.extremums)
    print(result)
    # формируем ответ
    response = {}
    idx = 0
    for uid in id_list:
        max_raw = result[idx]
        min_raw = result[idx + 1]
        idx += 2

        response[uid] = {
            "max": json.loads(max_raw) if max_raw else None,
            "min": json.loads(min_raw) if min_raw else None,
        }

    return response