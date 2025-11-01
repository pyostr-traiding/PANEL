from app.order.models import OrderModel, OrderStatus
from app.order.service.handlers.status_handlers import status_order_handler


@status_order_handler(
    status=OrderStatus.COMPLETED,
    source=[OrderStatus.ACCEPT_MONITORING],
)
def handle_completed_order(order: OrderModel, data):
    # position.set_status_completed()
    print("✅ Ордер завершена")
    r = order.get_extremum()
    for i in r:
        print(i)
        print(i.get_title())
