import uuid

from decimal import Decimal
from typing import Literal, Optional, Any

from pydantic import BaseModel


# Основная схема ордера для возврата через API
class OrderSchema(BaseModel):
    class Config:
        from_attributes = True  # Позволяет инициализировать из ORM объектов

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
    target_rate: Decimal
    close_rate: Optional[Decimal] = None

    created_at: Any  # обычно datetime, но сохраняем гибкость


# Значение экстремума — хранит само значение и время
class OrderExtremumValueSchema(BaseModel):
    class Config:
        from_attributes = True

    value: str
    dt: str


# Заголовки для отображения разных типов экстремумов
titles: dict = {
    ("extremum", "max"): "Максимальное значение",
    ("extremum", "min"): "Минимальное значение",
    ("extremum", "avg"): "Среднее значение",
    ("price", "high"): "Наивысшая цена",
}


# Схема для хранения данных экстремума в Redis
class OrderExtremumSchema(BaseModel):
    class Config:
        from_attributes = True

    key: Optional[str] = None
    value: Optional[OrderExtremumValueSchema] = None

    def get_title(self) -> str:
        """
        Возвращает человекочитаемый заголовок экстремума.
        Если ключ не найден в словаре — возвращает сам ключ.
        """
        parts = self.key.split(":")
        for key_parts, title in titles.items():
            if all(part in parts for part in key_parts):
                return title
        return self.key


# Схема для запроса на закрытие ордера
class CloseOrderSchema(BaseModel):
    uuid: str
    rate: Decimal
