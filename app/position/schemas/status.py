from typing import Literal

from pydantic import BaseModel


class ChangeStatusSchema(BaseModel):
    """
    Схема позиции
    """
    uuid: str
    status: Literal['monitoring', 'completed', 'cancel']
