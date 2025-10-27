from decimal import Decimal
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from app.order.models import OrderModel
from app.setting.models import ExchangeModel
from app.order.models import OrderCreditingModel


@receiver(post_save, sender=OrderModel)
def create_order_crediting(sender, instance: OrderModel, created, **kwargs):
    """
    Сигнал — при создании ордера автоматически создает зачисления (мейкер и тейкер)
    и обновляет accumulated_funding. Всё выполняется в одной транзакции.
    """
    if not created:
        return

    exchange = ExchangeModel.objects.get(name="bybit")

    try:
        price = Decimal(instance.price)
        qty = Decimal(instance.qty_tokens)
        position_value = price * qty
    except Exception as e:
        print(f"[Commission calc error]: {e}")
        return

    maker_commission = position_value * Decimal(exchange.maker_fee)
    taker_commission = position_value * Decimal(exchange.taker_fee)
    total_commission = maker_commission + taker_commission

    # 💥 Всё делаем атомарно
    with transaction.atomic():
        # 1️⃣ Обновляем поле accumulated_funding
        instance.accumulated_funding += total_commission
        instance.save(update_fields=["accumulated_funding"])

        # 2️⃣ Создаем зачисления (мейкер и тейкер)
        OrderCreditingModel.objects.bulk_create([
            OrderCreditingModel(
                order=instance,
                type='fee',
                count=maker_commission,
                comment=f"Зачисление комиссии мейкера ({exchange.maker_fee * 100:.3f}%)"
            ),
            OrderCreditingModel(
                order=instance,
                type='fee',
                count=taker_commission,
                comment=f"Зачисление комиссии тейкера ({exchange.taker_fee * 100:.3f}%)"
            )
        ])

        print(
            f"[Commission Added] Maker: {maker_commission:.8f}, "
            f"Taker: {taker_commission:.8f}, Total: {total_commission:.8f}"
        )
