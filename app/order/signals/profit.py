from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver

from app.order.models import OrderModel
from app.setting.models import ExchangeModel


@receiver(post_save, sender=OrderModel)
def create_order_crediting(sender, instance: OrderModel, created, **kwargs):
    """
    После создания ордера рассчитываем целевую цену для получения 1 USDT прибыли
    с учётом комиссии биржи.
    """
    if not created:
        return

    # Берём комиссию биржи
    exchange = ExchangeModel.objects.get(name="bybit")

    target_profit_usdt = Decimal(exchange.target_percent)

    price = Decimal(instance.price)
    qty_tokens = Decimal(instance.qty_tokens)

    # Стоимость позиции
    position_value = price * qty_tokens

    # Комиссия (в долларах)
    maker_commission = position_value * Decimal(exchange.maker_fee)
    taker_commission = position_value * Decimal(exchange.taker_fee)
    total_commission = maker_commission + taker_commission

    # Расчёт целевой цены в зависимости от стороны ордера
    if instance.side.lower() == "buy":
        target_price = price + (target_profit_usdt + total_commission) / qty_tokens
    else:  # sell
        target_price = price - (target_profit_usdt + total_commission) / qty_tokens

    instance.target_rate = target_price.quantize(Decimal('0.01'))
    instance.save()
