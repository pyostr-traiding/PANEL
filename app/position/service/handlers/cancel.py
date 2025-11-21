import logging
from typing import Union

from app.position.models import PositionModel, PositionStatus
from app.position.schemas.base import PositionSchema
from app.position.service.handlers.status_handlers import status_handler
from app.utils import response
from app.utils.rabbit import send_to_rabbitmq

logger = logging.getLogger(__name__)


@status_handler(
    status=PositionStatus.CANCEL,
    source=[PositionStatus.CREATED, PositionStatus.ACCEPT_MONITORING],
)
def handle_cancel(
        position: PositionModel,
        data,
) -> Union[PositionSchema, response.BaseResponse]:
    """
    Перевод позиции в статус "Отмену"
    """

    prev_status = position.status
    position.status = PositionStatus.CANCEL
    position.save()
    schema = PositionSchema.model_validate(position)

    return schema

