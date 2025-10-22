from functools import wraps
from app.position.models import PositionStatus, PositionModel
from app.utils import response

# Глобальный реестр обработчиков
STATUS_HANDLERS = {}


def status_handler(status: PositionStatus, source: list[PositionStatus]):
    """
    Декоратор для регистрации функции как обработчика смены статуса
    """
    print(1)
    def decorator(func):
        STATUS_HANDLERS[status] = {
            "handler": func,
            "source": source,
        }
        print(STATUS_HANDLERS)

        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper
    return decorator