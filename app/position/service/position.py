import json
from decimal import Decimal

import django
import pika

from typing import Union

from django.db import transaction

from app.position.models import PositionModel
from app.position.schemas.position import CreatePositionSchema, PositionSchema
from app.setting.models import SymbolModel
from app.utils import response


# def send_to_rabbitmq(
#         queue: str,
#         message: dict,
# ) -> bool:
#     """
#     Отправить сообщение в RabbitMQ.
#     Возвращает True при успехе, иначе False.
#     """
#     try:
#         connection = pika.BlockingConnection(connection_params)
#         channel = connection.channel()
#
#         channel.queue_declare(queue=queue, durable=True)
#
#         body = json.dumps(message, default=json_serializer, ensure_ascii=False)
#
#         channel.basic_publish(
#             exchange='',
#             routing_key=queue,
#             body=body,
#             properties=pika.BasicProperties(
#                 delivery_mode=2  # сообщение сохраняется при сбоях
#             )
#         )
#
#         print(f"[x] Отправлено сообщение в очередь '{queue}': {message}")
#         connection.close()
#         return True
#
#     except Exception as e:
#         print(f"[!] Ошибка отправки в RabbitMQ: {e}")
#         return False
def get_position_qty(
        symbol: SymbolModel,
        position_data: CreatePositionSchema,
):
    """
    Получить сумму для сделки
    """
    qty =  Decimal(position_data.price) / Decimal(symbol.qty_USDT_for_order)
    return str(qty)

def create_position(
        position_data: CreatePositionSchema,
):
    """
    Создать новую позицию
    """
    try:
        with transaction.atomic():
            symbol = SymbolModel.objects.get(name=position_data.symbol_name)
            qty_tokens = get_position_qty(symbol=symbol, position_data=position_data)
            result_create = PositionModel.objects.create(
                symbol=symbol,
                uuid=position_data.uuid,
                category=position_data.category,
                side=position_data.side,
                qty_tokens=qty_tokens,
                price=position_data.price,
                is_test=position_data.is_test,
            )
    except django.db.utils.IntegrityError as e:
        if 'Duplicate entry' in e.args[1]:
            return response.ConflictResponse(
                msg='Уже создана запись с таким ID'
            )
        raise e

    # # Здесь транзакция уже коммитнулась, запись точно в базе
    # message = PositionSchema(**result_create.__dict__).model_dump()
    # if not send_to_rabbitmq(queue='queue_position', message=message):
    #     # Очередь не приняла, но запись уже в базе — можно пометить как failed или удалить
    #     result_create.delete()
    #     return response.OtherErrorResponse(msg='Ошибка отправки в RabbitMQ')

    return PositionSchema(**result_create.__dict__)
