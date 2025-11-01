from secrets import compare_digest

from ninja.security import HttpBearer


class GlobalAuth(HttpBearer):
    def authenticate(self, request, token: str):
        if compare_digest(token, 'GVkX2F0IjoxNiJIUzI1NiIQiOjE3NTA5MO1o40_oWRuDjjcHBfaWQiOj8d44VhdGVkX2F0Ij'):
            return token
