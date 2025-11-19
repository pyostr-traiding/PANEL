from pydantic import BaseModel


class IndicatorSchema(BaseModel):
    name: str
    json: dict