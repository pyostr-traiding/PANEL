from typing import Union
import logging

from app.order.service.base import create_order
from app.position.models import PositionStatus, PositionModel
from app.position.schemas.base import PositionSchema
from app.position.service.handlers.status_handlers import status_handler
from app.utils.rabbit import send_to_rabbitmq
from app.utils import response

logger = logging.getLogger(__name__)


@status_handler(
    status=PositionStatus.COMPLETED,
    source=[PositionStatus.ACCEPT_MONITORING],
)
def handle_accept_monitoring(
        position: PositionModel,
        data,
) -> Union[PositionSchema, response.BaseResponse]:
    result_create = create_order(
        position=position,
        data=data
    )
    return result_create