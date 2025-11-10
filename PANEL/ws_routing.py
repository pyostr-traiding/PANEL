from django.urls import re_path

from consumers.gpt import GPTConsumer
from consumers.kline import KlineConsumer
from consumers.orderbook import OrderbookConsumer
from consumers.signals.macd import MACDConsumer
from consumers.signals.rsi import RSIConsumer
from consumers.trade_update import TradeConsumer

websocket_urlpatterns = [
    re_path(r'ws/kline/$', KlineConsumer.as_asgi()),
    re_path(r'ws/signals/$', RSIConsumer.as_asgi()),
    re_path(r'ws/signals/macd/$', MACDConsumer.as_asgi()),
    re_path(r'ws/orderbook/$', OrderbookConsumer.as_asgi()),
    re_path(r'ws/gpt/$', GPTConsumer.as_asgi()),

    re_path(r'ws/trade_update/$', TradeConsumer.as_asgi()),

]
