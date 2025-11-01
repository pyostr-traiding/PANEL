from datetime import datetime, time
from decimal import Decimal
from typing import List

from django.db import transaction
from django.utils import timezone as dj_tz

from pybit.unified_trading import HTTP

from app.order.models import (
    OrderCreditingModel,
    OrderHistoryModel,
    OrderModel,
    OrderStatus,
)


def get_current_funding_rate(symbol="BTCUSDT", category="linear") -> Decimal:
    session = HTTP(testnet=False)
    resp = session.get_funding_rate_history(category=category, symbol=symbol, limit=1)
    return Decimal(resp["result"]["list"][0]["fundingRate"])


def calculate_funding_fee(position_size: Decimal, mark_price: Decimal, funding_rate: Decimal, side: str) -> Decimal:
    position_value = position_size * mark_price
    fee = position_value * funding_rate
    if side.lower() == "long":
        fee = -fee if funding_rate > 0 else abs(fee)
    else:
        fee = -fee if funding_rate < 0 else abs(fee)
    return fee


def get_current_funding_window(now=None):
    """
    Возвращает границы текущего окна фандинга:
    00:00–07:59, 08:00–15:59, 16:00–23:59
    """
    now = now or dj_tz.now()
    date = now.date()

    windows = [
        (time(0, 0), time(8, 0)),
        (time(8, 0), time(16, 0)),
        (time(16, 0), time(23, 59, 59, 999999)),
    ]

    for start, end in windows:
        start_dt = dj_tz.make_aware(datetime.combine(date, start))
        end_dt = dj_tz.make_aware(datetime.combine(date, end))
        if start_dt <= now <= end_dt:
            return start_dt, end_dt

    return dj_tz.make_aware(datetime.combine(date, time(0, 0))), dj_tz.make_aware(datetime.combine(date, time(23, 59, 59)))


def has_funding_in_window(order: OrderModel) -> bool:
    """Проверяет, было ли уже начисление фандинга в этом окне."""
    start_dt, end_dt = get_current_funding_window()
    return OrderCreditingModel.objects.filter(
        order=order,
        type="funding",
        created_at__gte=start_dt,
        created_at__lte=end_dt,
    ).exists()


def accumulate_funding():
    """Начисляет funding-комиссию всем активным ордерам (если ещё не было)."""

    orders: List[OrderModel] = OrderModel.objects.filter(
        status__in=[OrderStatus.CREATED, OrderStatus.ACCEPT_MONITORING],
    )

    for order in orders:
        if has_funding_in_window(order):
            print(f"[{order.id}] funding уже начислен — пропуск.")
            continue

        position_size = Decimal(order.qty_tokens)
        side = order.side
        mark_price = Decimal(order.price)

        funding_rate = get_current_funding_rate(order.position.symbol.name)
        funding_fee = calculate_funding_fee(position_size, mark_price, funding_rate, side)

        with transaction.atomic():
            old_funding = order.accumulated_funding
            new_funding = old_funding + funding_fee

            order.accumulated_funding = new_funding
            order.save(update_fields=["accumulated_funding"])

            OrderCreditingModel.objects.create(
                order=order,
                type="funding",
                count=funding_fee,
                comment=f"Фандинг {order.position.symbol.name} @ {funding_rate:.6f}",
            )

            print(f"[{order.id}] funding начислен | rate={funding_rate:.6f} | fee={funding_fee:.6f}")
