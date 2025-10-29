from typing import Literal, Optional

from pydantic import BaseModel


class ChangeStatusSchema(BaseModel):
    """
    Схема позиции
    """
    uuid: str
    status: Literal['monitoring', 'completed', 'cancel']
    kline_ms: Optional[str] = None
