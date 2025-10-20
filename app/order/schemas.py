import uuid
from typing import Any, Literal

from pydantic import BaseModel


class OrderSchema(BaseModel):
    id: int
    uuid: uuid.UUID
    position_uuid: uuid.UUID
    symbol: str
    category: Literal['spot', 'option']
    side: Literal['buy', 'sell']
    price: str
    qty_tokens: str
    is_test: bool
    created_at: Any
