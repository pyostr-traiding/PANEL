import uuid
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class CreditingSchema(BaseModel):
    class Config:
        from_attributes = True

    order_uuid: str

    type: Literal['funding', 'fee']
    count: Decimal
    comment: str