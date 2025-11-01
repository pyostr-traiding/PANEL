import asyncio
import json
import os

import redis.asyncio as aioredis
from channels.generic.websocket import AsyncWebsocketConsumer
from dotenv import load_dotenv

load_dotenv()

class MACDConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

        self.redis = aioredis.Redis(
            host=os.getenv('REDIS_HOST'),
            port=int(os.getenv('REDIS_PORT')),
            password=os.getenv('REDIS_PASSWORD'),
            db=2
        )

        # Подписка на канал
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe('signals:MACD:BTCUSDT')

        # Запускаем отдельную задачу, которая будет слушать Redis
        self.task = asyncio.create_task(self.stream_from_redis())

    async def disconnect(self, close_code):
        if hasattr(self, 'task'):
            self.task.cancel()
        if hasattr(self, 'pubsub'):
            await self.pubsub.close()
        if hasattr(self, 'redis'):
            await self.redis.close()

    async def stream_from_redis(self):
        try:
            async for message in self.pubsub.listen():
                if message is None:
                    continue
                if message['type'] == 'message':
                    data = message['data']
                    if isinstance(data, bytes):
                        data = data.decode()

                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    await self.send(text_data=json.dumps(payload))
        except asyncio.CancelledError:
            pass

