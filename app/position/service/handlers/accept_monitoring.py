from app.position.models import PositionModel, PositionStatus
from app.position.service.status_handlers import status_handler


@status_handler(
    status=PositionStatus.ACCEPT_MONITORING,
    source=[PositionStatus.CREATED],
)
def handle_accept_monitoring(
        position: PositionModel,
        data,
):
    position.set_status_position_accept_monitoring_service()
    position.refresh_from_db(fields=['status', 'updated_at'])
    return position
