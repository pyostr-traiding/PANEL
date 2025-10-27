import uuid
from decimal import Decimal

from pydantic import BaseModel, Field
from typing import Literal, Optional, Any



class CreditingSchema(BaseModel):
    class Config:
        from_attributes = True

    order_uuid: str

    type: Literal['funding', 'fee']
    count: Decimal
    comment: str