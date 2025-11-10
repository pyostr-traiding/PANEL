# signals.py
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import pre_save
from django.dispatch import receiver

from app.order.models import OrderModel
from app.order.schemas.base import OrderSchema


@receiver(pre_save, sender=OrderModel)
def change_order_push_socket(sender, instance: OrderModel, **kwargs):
    """
    Отправка уведомления всем клиентам, когда ордер изменяется.
    """
    channel_layer = get_channel_layer()
    payload = OrderSchema.model_validate(instance)
    payload.status_title = instance.get_status_display().upper()
    payload = payload.model_dump(mode="json")


    async_to_sync(channel_layer.group_send)(
        "trade_update",
        {
            "type": "trade_update",
            "data": {
                "method": "order_update",
                "data": payload
            },
        },
    )
