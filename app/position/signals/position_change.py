# signals.py
import json

from amqp.spec import method
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from app.position.models import PositionModel
from app.position.schemas.base import PositionSchema


@receiver(post_save, sender=PositionModel)
def change_positions_push_socket(sender, instance: PositionModel, **kwargs):
    """
    Отправка уведомления всем клиентам, когда позиция изменяется.
    """
    channel_layer = get_channel_layer()

    payload = PositionSchema.model_validate(instance)
    payload.status_title = instance.get_status_display().upper()
    payload = payload.model_dump(mode="json")

    async_to_sync(channel_layer.group_send)(
        "trade_update",
        {
            "type": "trade_update",
            "data": {
                "method": "position_update",
                "data": payload
            },
        },
    )
