from django.urls import re_path

from consumers.kline import KlineConsumer
from consumers.orderbook import OrderbookConsumer
from consumers.signals.macd import MACDConsumer
from consumers.signals.rsi import RSIConsumer

websocket_urlpatterns = [
    re_path(r'ws/kline/$', KlineConsumer.as_asgi()),
    re_path(r'ws/signals/$', RSIConsumer.as_asgi()),
    re_path(r'ws/signals/macd/$', MACDConsumer.as_asgi()),

    re_path(r'ws/orderbook/$', OrderbookConsumer.as_asgi()),
]
