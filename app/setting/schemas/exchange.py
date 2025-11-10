from pydantic import BaseModel


class ExchangeSchema(BaseModel):
    class Config:
        from_attributes = True

    id: int
    name: str
    base_url: str
    maker_fee: float
    taker_fee: float
    target_percent: float
