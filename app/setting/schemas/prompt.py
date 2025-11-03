from pydantic import BaseModel


class PromptSchema(BaseModel):
    class Config:
        from_attributes = True

    id: int
    title: str
    code: str
    prompt: str
    description: str
