from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class PermissionsSchema(BaseModel):
    main_menu: bool
    glaz_menu: bool
    receipt_menu: bool

class CreateTGUserSchema(BaseModel):
    """
    Схема пользователя
    """
    chat_id: str
    username: Optional[str] = None

class TGUserSchema(BaseModel):
    """
    Схема пользователя
    """
    chat_id: str
    username: Optional[str] = None
    balance: Optional[int] = None
    is_trader: Optional[bool] = False
    permissions: PermissionsSchema = None

class GetBalanceTgUserSchema(BaseModel):
    """
    Схема баланса
    """
    chat_id: str
    decries: bool = False

class BalanceTgUserSchema(BaseModel):
    """
    Схема баланса
    """
    chat_id: str
    balance: Optional[int] = None


