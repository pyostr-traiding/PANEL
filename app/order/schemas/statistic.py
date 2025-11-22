from pydantic import BaseModel
from typing import Optional
from datetime import date

class StatisticOrderSchema(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    statuses: Optional[str] = None