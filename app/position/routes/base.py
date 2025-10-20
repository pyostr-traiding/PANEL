"""
Базовые методы GET/POST
"""
from django.http import HttpRequest
from ninja import Router

from app.position.schemas.base import CreatePositionSchema
from app.position.service.base import create_position, get_position
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq

router = Router(
    tags=['Позиции'],
)

@router.post(
    path='/create',
)
def api_create_position(
        request: HttpRequest,
        data: CreatePositionSchema,
):
    """
    Создать позицию
    Созданная позиция сохраняется в базу и отправляется в очередь RabbitMQ
    Из очереди заявку на позицию обрабатывается сервисом COMMANDER

    Заявка живет в рамках минуты свечи для которой открывается позиция
    После помечается как "Не востребовано" по причине истекшего времени

    Статусы:
    200 - Создано
    409 - Отклонено, заявка уже создана
    406 - Запрещено, время истекло
    """

    result = create_position(
        position_data=data,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    text = (
        f'Создана позиция:\n'
        f'ID: {result.uuid}\n'
        f'Сторона: {result.side}\n'
        f'Сумма: {float(result.price) * float(result.qty_tokens)} USDT\n'
        f'Кол-во: {result.qty_tokens} BTC\n'
        f'Вход: {result.price} USDT'
    )
    send_to_rabbitmq(
        queue='queue_telegram_mailing',
        message={
            "is_test": False,
            "notification": True,
            "text": text,
            "buttons": [{"title": "Открыть", "callback": f"new_pos.{result.uuid}"}]
        }
    )
    return result


@router.get(
    path='/',
)
def api_get_position(
        request: HttpRequest,
        uuid: str,
):
    """
    Получить позицию

    Статусы:
    200 - Создано
    404 - Не найдено
    """

    result = get_position(
        uuid=uuid,
    )
    if isinstance(result, response.BaseResponse):
        return response.return_response(result)
    return result