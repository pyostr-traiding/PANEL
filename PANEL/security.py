from ninja.security import HttpBearer
from secrets import compare_digest


class GlobalAuth(HttpBearer):
    def authenticate(self, request, token: str):
        if compare_digest(token, 'GVkX2F0IjoxNiJIUzI1NiIQiOjE3NTA5MO1o40_oWRuDjjcHBfaWQiOj8d44VhdGVkX2F0Ij'):
            return token
