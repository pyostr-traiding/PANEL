from functools import wraps

from app.position.models import PositionStatus

# Глобальный реестр обработчиков
STATUS_HANDLERS = {}


def status_handler(status: PositionStatus, source: list[PositionStatus]):
    """
    Декоратор для регистрации функции как обработчика смены статуса
    """
    def decorator(func):
        STATUS_HANDLERS[status] = {
            "handler": func,
            "source": source,
        }

        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper
    return decorator