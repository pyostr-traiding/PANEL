from typing import Union
import logging

from app.position.models import PositionStatus, PositionModel
from app.position.schemas.base import PositionSchema
from app.position.service.handlers.status_handlers import status_handler
from app.utils.rabbit import send_to_rabbitmq
from app.utils import response

logger = logging.getLogger(__name__)


@status_handler(
    status=PositionStatus.ACCEPT_MONITORING,
    source=[PositionStatus.CREATED],
)
def handle_accept_monitoring(
        position: PositionModel,
        data,
) -> Union[PositionSchema, response.BaseResponse]:
    """
    Перевод позиции в статус "Мониторинг"
    """

    prev_status = position.status
    position.status = PositionStatus.ACCEPT_MONITORING

    try:
        # Сохраняем изменение статуса
        position.save(update_fields=["status"])

        # Формируем сообщение
        schema = PositionSchema.model_validate(position)
        message = schema.model_json_schema()

        # Отправляем в RabbitMQ
        if not send_to_rabbitmq(queue="queue_monitoring_position", message=message):
            # Если не удалось — откатываем статус
            position.status = prev_status
            position.save(update_fields=["status"])
            logger.error(f"Не удалось отправить позицию {position.uuid} в RabbitMQ")
            return response.OtherErrorResponse(msg="Не удалось отправить позицию в мониторинг")

        logger.info(f"Позиция {position.uuid} переведена в мониторинг")
        return schema

    except Exception as e:
        # Если что-то пошло не так — откатываем статус
        position.status = prev_status
        position.save(update_fields=["status"])
        logger.exception(f"Ошибка при переводе позиции {position.uuid} в мониторинг: {e}")
        return response.OtherErrorResponse(msg=f"Ошибка при переводе в мониторинг: {e}")
