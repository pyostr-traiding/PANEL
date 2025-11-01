import logging
from typing import Union

from app.order.models import OrderModel, OrderStatus
from app.order.schemas.base import OrderSchema
from app.order.service.handlers.status_handlers import status_order_handler
from app.utils import response

logger = logging.getLogger(__name__)


@status_order_handler(
    status=OrderStatus.ACCEPT_MONITORING,
    source=[OrderStatus.CREATED],
)
def handle_accept_monitoring_order(
        order: OrderModel,
        data,
) -> Union[OrderSchema, response.BaseResponse]:
    """
    Перевод ордера в статус "Мониторинг"
    """

    order.status = OrderStatus.ACCEPT_MONITORING
    order.save()
    return OrderSchema.model_validate(order)
