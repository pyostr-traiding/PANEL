from decimal import Decimal, InvalidOperation, getcontext
from typing import Union, List

from django.http import HttpRequest
from ninja import Router

from app.order.models import OrderModel
from app.order.schemas.statistic import StatisticOrderSchema
from app.order.schemas.base import OrderSchema
from app.utils import response

router = Router(tags=['Ордера'])
getcontext().prec = 28


@router.post(path='/statistic/')
def api_filter_statistic_order(
        request: HttpRequest,
        data: StatisticOrderSchema,
):
    qs = OrderModel.objects.all()

    # фильтр по дате
    if data.date_from:
        qs = qs.filter(created_at__date__gte=data.date_from)
    if data.date_to:
        qs = qs.filter(created_at__date__lte=data.date_to)
    if data.statuses:
        qs = qs.filter(status__in=data.statuses)
    if not qs:
        return response.return_response(response.NotFoundResponse(
            msg='Пуфто'
        ))
    # контейнер по сторонам
    stats = {
        "buy": {
            "count": 0,
            "sum_price": Decimal("0"),
            "sum_qty": Decimal("0"),
            "sum_funding": Decimal("0"),
            "pnl": Decimal("0"),
            "net": Decimal("0"),
        },
        "sell": {
            "count": 0,
            "sum_price": Decimal("0"),
            "sum_qty": Decimal("0"),
            "sum_funding": Decimal("0"),
            "pnl": Decimal("0"),
            "net": Decimal("0"),
        },
        "other": {
            "count": 0,
            "sum_price": Decimal("0"),
            "sum_qty": Decimal("0"),
            "sum_funding": Decimal("0"),
            "pnl": Decimal("0"),
            "net": Decimal("0"),
        },
    }

    for order in qs:
        side = order.side if order.side in ("buy", "sell") else "other"

        # конвертация данных
        try:
            price = Decimal(order.price)
            qty = Decimal(order.qty_tokens)
            close = Decimal(order.close_rate) if order.close_rate is not None else None
            funding = Decimal(order.accumulated_funding)
        except InvalidOperation:
            print(f"[WARN] некорректные данные — ордер {order.uuid}")
            continue

        # пропустить незакрытые
        if close is None:
            print(f"[SKIP] close_rate отсутствует — ордер {order.uuid}")
            continue

        # расчёт pnl
        if side == "buy":
            pnl = (close - price) * qty
        elif side == "sell":
            pnl = (price - close) * qty
        else:
            pnl = Decimal("0")

        net = pnl - funding

        s = stats[side]
        s["count"] += 1
        s["sum_price"] += price
        s["sum_qty"] += qty
        s["sum_funding"] += funding
        s["pnl"] += pnl
        s["net"] += net

        print(
            f"ORD {order.uuid} | {side.upper()} "
            f"| entry={price} | exit={close} | qty={qty} "
            f"| pnl={pnl} | funding={funding} | net={net}"
        )

    # финальный вывод
    for side, s in stats.items():
        print(
            f"{side.upper()}: "
            f"orders={s['count']} | "
            f"sum_price={s['sum_price']} | "
            f"sum_qty={s['sum_qty']} | "
            f"sum_funding={s['sum_funding']} | "
            f"PnL={s['pnl']} | NET={s['net']}"
        )

    return stats
