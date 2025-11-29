import os

import redis


class RedisDB:
    stream: int = 0
    settings: int = 1
    cache: int = 2
    extremums: int = 3

    gpt: int = 5
    monitoring: int = 8

class RedisServer:
    def __init__(
            self,
            host: str,
            port: int,
            password: str,
    ):
        self._connections = {}
        self.host = host
        self.port = port
        self.password = password

    def _get_connection(self, db: int) -> redis.Redis:
        if db not in self._connections:
            self._connections[db] = redis.Redis(
                host=self.host,
                port=self.port,
                password=self.password,
                db=db,
                decode_responses=True
            )
        return self._connections[db]

    def get(self, key: str, db: int = 0):
        conn = self._get_connection(db)
        return conn.get(key)

    def mget(self, keys: str, db: int = 0):
        conn = self._get_connection(db)
        return conn.mget(keys)

    def set(self, key: str, value, db: int = 0):
        conn = self._get_connection(db)
        return conn.set(key, value)

    def delete(self, key: str, db: int = 0):
        conn = self._get_connection(db)
        return conn.delete(key)

    def scan(self, cursor, match, count, db: int = 0):
        conn = self._get_connection(db)
        return conn.scan(cursor=cursor, match=match, count=count)