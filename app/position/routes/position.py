from django.http import HttpRequest
from ninja import Router

from app.position.schemas.position import CreatePositionSchema
from app.position.service.position import create_position
from app.utils import response

router = Router(
    tags=['Позиции'],
)

@router.post(
    path='/create',
)
def api_position_create(
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
        f'Сумма: {float(result.price) * float(result.qty)} USDT\n'
        f'Кол-во: {result.qty} BTC\n'
        f'Вход: {result.price} USDT'
    )
    # send_to_rabbitmq(
    #     queue='mailing',
    #     message={
    #         "is_test": False,
    #         "notification": True,
    #         "text": text,
    #         "buttons": [{"title": "Открыть", "callback": f"new_pos.{result.uuid}"}]
    #     }
    # )
    return result
