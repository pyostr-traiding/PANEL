from app.position.models import PositionStatus, PositionModel
from app.position.service.status_handlers import status_handler
from app.utils import response


@status_handler(
    status=PositionStatus.COMPLETED,
    source=[PositionStatus.ACCEPT_MONITORING],
)
def handle_completed(position: PositionModel, data):
    # position.set_status_completed()
    print("✅ Позиция завершена")
