from django.db import transaction

from app.order.models import OrderModel
from app.order.schemas import OrderSchema
from app.position.models import PositionModel, PositionStatus
from app.position.service.status_handlers import status_handler
from app.utils.rabbit import send_to_rabbitmq


@status_handler(
    status=PositionStatus.COMPLETED,
    source=[PositionStatus.ACCEPT_MONITORING],
)
def handle_completed(position: PositionModel, data):
    with transaction.atomic():
        position.set_status_completed()
        position.refresh_from_db(fields=['status', 'updated_at'])

        order = OrderModel.objects.create(
            position=position,
            symbol=position.symbol,
            category=position.category,
            side=position.side,
            price=position.price,
            qty_tokens=position.qty_tokens,
            is_test=position.is_test,
        )

        order_payload = OrderSchema(
            id=order.id,
            uuid=order.uuid,
            position_uuid=position.uuid,
            symbol=order.symbol.name,
            category=order.category,
            side=order.side,
            price=order.price,
            qty_tokens=order.qty_tokens,
            is_test=order.is_test,
            created_at=order.created_at,
        )

        if not send_to_rabbitmq(queue='OrderQueue', message=order_payload.model_dump()):
            raise RuntimeError('Не удалось отправить данные ордера в RabbitMQ')

    return position
