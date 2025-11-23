import datetime
import json

from django.http import HttpRequest

from ninja import Router

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.frontend.schemas.gpt import SendMessageSchema, DeleteSchema
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq

router = Router(
    tags=['Фронтенд'],
)


@router.get(
    path='/gpt/filter',
)
def api_filter_gpt_chats(
        request: HttpRequest,
        page: int,
        per_page: int = 10
):

    """
    Возвращает список ключей чатов по страницам
    """
    all_keys = []
    cursor = 0
    pattern = "chat:*"
    while True:
        cursor, keys = redis_server.scan(cursor=cursor, match=pattern, count=100, db=RedisDB.gpt)
        all_keys.extend(keys)
        if cursor == 0:
            break

    # Считаем срез по страницам
    start = (page - 1) * per_page
    end = start + per_page
    result = all_keys[start:end]
    if not result:
        return response.return_response(response.NotFoundResponse(
            msg='Пуфто'
        ))
    return result


@router.get(
    path='/gpt/',
)
def api_get_gpt_chat(
        request: HttpRequest,
        key: str,
):

    """
    Возвращает список ключей чатов по страницам
    """


    res = redis_server.get(key, db=RedisDB.gpt)
    if not res:
        return response.return_response(response.NotFoundResponse(
            msg='Пуфто'
        ))
    res = json.loads(res)
    return res


@router.post(
    path='/gpt/send',
)
def api_send_to_gpt_chat(
        request: HttpRequest,
        data: SendMessageSchema,
):

    """
    Возвращает список ключей чатов по страницам
    """
    payload = {
        "action": "new_message_in_chat",
        "tg_id": "572982939",
        "created_on": str(datetime.datetime.now(datetime.UTC)),
        "extra": {
            'uuid': data.uuid,
            'text': data.text,
            'code': data.code,
        }
    }
    x = send_to_rabbitmq(
        queue='queue_gpt_message',
        message=json.dumps(payload),
    )
    if x:
        return True

    return response.return_response(response.OtherErrorResponse(msg='Ошибка отправки в rabbit'))


@router.delete(
    path='/gpt/delete',
)
def api_delete_gpt_chat(
        request: HttpRequest,
        data: DeleteSchema,
):

    """
    Возвращает список ключей чатов по страницам
    """
    res = redis_server.delete(data.uuid, db=RedisDB.gpt)

    if res:
        return True

    return response.return_response(response.OtherErrorResponse(msg='Ошибка отправки в rabbit'))