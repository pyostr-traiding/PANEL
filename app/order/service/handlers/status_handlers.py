from functools import wraps

from app.order.models import OrderStatus

# Глобальный реестр обработчиков
STATUS_ORDER_HANDLERS = {}


def status_order_handler(status: OrderStatus, source: list[OrderStatus]):
    """
    Декоратор для регистрации функции как обработчика смены статуса
    """
    def decorator(func):
        STATUS_ORDER_HANDLERS[status] = {
            "handler": func,
            "source": source,
        }

        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper
    return decorator