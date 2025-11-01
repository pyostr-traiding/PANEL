import json

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from app.order.models import OrderHistoryModel, OrderModel

_PREVIOUS_STATE = {}


@receiver(pre_save, sender=OrderModel)
def cache_previous_order_state(sender, instance: OrderModel, **kwargs):
    """Кешируем старое состояние перед обновлением"""
    if not instance.pk:
        return
    try:
        old = sender.objects.get(pk=instance.pk)
        _PREVIOUS_STATE[instance.pk] = {
            "accumulated_funding": old.accumulated_funding,
            "category": old.category,
            "side": old.side,
            "price": old.price,
            "qty_tokens": old.qty_tokens,
            "status": old.status,
        }
    except sender.DoesNotExist:
        pass


@receiver(post_save, sender=OrderModel)
def create_order_history_on_save(sender, instance: OrderModel, created, **kwargs):
    """Глобальный лог изменений"""
    old = _PREVIOUS_STATE.get(instance.pk)

    # Создание нового ордера
    if created:
        OrderHistoryModel.objects.create(
            order=instance,
            action_name="created",
            update_data={
                "full_data": {
                    "category": instance.category,
                    "side": instance.side,
                    "price": str(instance.price),
                    "qty_tokens": str(instance.qty_tokens),
                    "status": instance.status,
                    "accumulated_funding": str(instance.accumulated_funding),
                }
            },
            comment="Создан новый ордер",
        )
        return

    # Если это обновление
    changed_fields = {}
    if old:
        for field in ["category", "side", "price", "qty_tokens", "status", "accumulated_funding"]:
            old_val = str(old[field])
            new_val = str(getattr(instance, field))
            if old_val != new_val:
                changed_fields[field] = {"old": old_val, "new": new_val}

    # если изменилось только accumulated_funding — выходим (это обрабатывается отдельным сигналом)
    if len(changed_fields.keys()) == 1 and "accumulated_funding" in changed_fields:
        return

    # создаём запись в истории
    OrderHistoryModel.objects.create(
        order=instance,
        action_name="updated",
        update_data={
            "changed_fields": changed_fields,
            "full_data": {
                "category": instance.category,
                "side": instance.side,
                "price": str(instance.price),
                "qty_tokens": str(instance.qty_tokens),
                "status": instance.status,
                "accumulated_funding": str(instance.accumulated_funding),
            },
        },
        comment="Ордер обновлён",
    )


@receiver(post_save, sender=OrderModel)
def create_order_history_on_accumulated_funding_change(sender, instance: OrderModel, created, **kwargs):
    """Отдельный лог, если изменилось accumulated_funding"""
    if created:
        return

    old = _PREVIOUS_STATE.pop(instance.pk, None)
    if not old:
        return

    if str(old["accumulated_funding"]) != str(instance.accumulated_funding):
        OrderHistoryModel.objects.create(
            order=instance,
            action_name="accumulated_funding_changed",
            update_data={
                "old_accumulated_funding": str(old["accumulated_funding"]),
                "new_accumulated_funding": str(instance.accumulated_funding),
            },
            comment=f"Поле accumulated_funding изменено с {old['accumulated_funding']} на {instance.accumulated_funding}",
        )
