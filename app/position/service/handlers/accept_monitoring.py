from position.models import PositionStatus, PositionModel
from position.service.status_handlers import status_handler
from app.utils import response


@status_handler(
    status=PositionStatus.ACCEPT_MONITORING,
    source=[PositionStatus.CREATED],
)
def handle_accept_monitoring(
        position: PositionModel,
        data,
):
    position.set_status_position_accept_monitoring_service()
    # тут можно добавить логику отправки в RabbitMQ и т.д.
    print("✅ Переведено в мониторинг")
