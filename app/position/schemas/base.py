import time
import uuid

from django.db.models import JSONField
from pydantic import BaseModel, Field
from typing import Literal, Optional, Any

from pydantic_core.core_schema import JsonSchema


class CreatePositionSchema(BaseModel):
    """
    Схема позиции
    """
    symbol_name: str = 'BTCUSDT'
    uuid: str
    category: Literal['spot', 'option']
    side: Literal['buy', 'sell']
    price: str
    kline_ms: int
    is_test: bool

    class Config:
        json_schema_extra = {
            "example": {
                "symbol_name": "BTCUSDT",
                "uuid": str(uuid.uuid4()),
                "category": "spot",
                "side": "buy",
                "price": "100000",
                "kline_ms": int(time.time() * 1_000),
                "is_test": True
            }
        }


class PositionSchema(BaseModel):

    id: int

    symbol_name: str = 'BTCUSDT'
    status: str

    uuid: uuid.UUID
    category: Literal['spot', 'option']
    side: Literal['buy', 'sell']
    qty_tokens: str
    price: str
    is_test: bool

    created_at: Any

