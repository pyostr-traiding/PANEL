from pydantic import BaseModel


class GPTSchema(BaseModel):
    class Config:
        from_attributes = True
    name: str
    code: str
    context: int