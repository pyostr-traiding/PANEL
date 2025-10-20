from app.position.models import PositionModel, PositionStatus
from app.position.service.status_handlers import status_handler


@status_handler(
    status=PositionStatus.CANCEL,
    source=[
        PositionStatus.CREATED,
        PositionStatus.ACCEPT_MONITORING,
        PositionStatus.COMPLETED,
    ],
)
def handle_cancel(position: PositionModel, data):
    position.set_status_cancel()
    position.refresh_from_db(fields=['status', 'updated_at'])
    return position
