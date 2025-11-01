import json

import pika

from PANEL.settings import connection_params
from app.utils.serializer import json_serializer


def send_to_rabbitmq(
        queue: str,
        message: str,
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
                delivery_mode=2
            )
        )
        print(f"[x] Отправлено сообщение в очередь '{queue}': {message}")
        connection.close()
        return True

    except Exception as e:
        print(f"[!] Ошибка отправки в RabbitMQ: {e}")
    return False
