import json
import uuid
from datetime import datetime, UTC
from pprint import pprint

import pika
from celery import shared_task

from PANEL.settings import connection_params
from app.setting.models import GPTModel
from app.utils.serializer import json_serializer


def send_to_rabbitmq(
        message: dict,
        queue: str = 'queue_gpt_analiz',
) -> bool:
    """
    Отправить сообщение в RabbitMQ.
    Возвращает True при успехе, иначе False.
    """
    try:
        connection = pika.BlockingConnection(connection_params)
        channel = connection.channel()

        channel.queue_declare(queue=queue, durable=True)

        body = json.dumps(message, default=json_serializer, ensure_ascii=False)

        channel.basic_publish(
            exchange='',
            routing_key=queue,
            body=body,
            properties=pika.BasicProperties(
                delivery_mode=2  # сообщение сохраняется при сбоях
            )
        )

        print(f"[x] Отправлено сообщение в очередь '{queue}': {message}")
        connection.close()
        return True

    except Exception as e:
        print(f"[!] Ошибка отправки в RabbitMQ: {e}")
        return False



@shared_task
def analiz_trend(
        model_id: int
):
    gpt_model: GPTModel = GPTModel.objects.get(id=model_id)

    payload = {
            "action": "trend_analiz",
            "tg_id": "572982939",
            "created_on": str(datetime.now(UTC)),
            "extra": {
                "uuid": str(uuid.uuid4()),
                "text": "Анализ тренда",
                "code":  gpt_model.code,
                "context": gpt_model.context,
            }
        }
    print(payload)
    send_to_rabbitmq(payload)
