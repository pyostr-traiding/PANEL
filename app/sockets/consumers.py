import json
from channels.generic.websocket import AsyncWebsocketConsumer


class KlinesConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "redis_channel"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def redis_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'kline',
            'message': message
        }))


class SignalsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "signals_channel"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def redis_message(self, event):  # <-- ЭТОГО НЕ ХВАТАЛО
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'signal',
            'message': message
        }))