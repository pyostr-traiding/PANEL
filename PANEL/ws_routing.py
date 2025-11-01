from django.urls import re_path

from consumers.kline import KlineConsumer
from consumers.orderbook import OrderbookConsumer
from consumers.signals import SignalsConsumer

websocket_urlpatterns = [
    re_path(r'ws/kline/$', KlineConsumer.as_asgi()),
    re_path(r'ws/signals/$', SignalsConsumer.as_asgi()),

    re_path(r'ws/orderbook/$', OrderbookConsumer.as_asgi()),
]
