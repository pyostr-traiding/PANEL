import time
import uuid
from decimal import Decimal

from django.db.models import JSONField
from pydantic import BaseModel, Field
from typing import Literal, Optional, Any

from pydantic_core.core_schema import JsonSchema


class OrderSchema(BaseModel):
    class Config:
        from_attributes = True

    id: int

    symbol_name: str = 'BTCUSDT'
    status: str

    uuid: uuid.UUID
    category: Literal['spot', 'option']
    side: Literal['buy', 'sell']
    qty_tokens: str
    price: str
    status_title: Optional[str] = None
    accumulated_funding: Decimal
    created_at: Any

class OrderExtremumValueSchema(BaseModel):
    class Config:
        from_attributes = True

    value: str
    dt: str

titles: dict = {
        ("extremum", "max"): "Максимальное значение",
        ("extremum", "min"): "Минимальное значение",
        ("extremum", "avg"): "Среднее значение",
        ("price", "high"): "Наивысшая цена",
    }
class OrderExtremumSchema(BaseModel):
    class Config:
        from_attributes = True

    key: Optional[str] = None
    value: Optional[OrderExtremumValueSchema] = None


    def get_title(self) -> str:
        parts = self.key.split(":")
        for key_parts, title in titles.items():
            if all(part in parts for part in key_parts):
                return title
        return self.key
