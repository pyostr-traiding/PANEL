from django.urls import re_path

from app.sockets import consumers

websocket_urlpatterns = [
    re_path(r'ws/redis/$', consumers.KlinesConsumer.as_asgi()),
    re_path(r'ws/signals/$', consumers.SignalsConsumer.as_asgi()),
]