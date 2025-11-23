import time
import uuid
from typing import Any, Literal, Optional

from django.db.models import JSONField

from pydantic import BaseModel, Field
from pydantic_core.core_schema import JsonSchema


class SendMessageSchema(BaseModel):
    uuid: str
    text: str
    code: str

class DeleteSchema(BaseModel):
    uuid: str
