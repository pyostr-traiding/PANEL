import datetime
import json
from typing import Optional

from django.contrib.auth import authenticate, login, logout
import pyotp
from django.http import HttpRequest, JsonResponse
from ninja import Router
from ninja.constants import NOT_SET
from ninja.security import django_auth
from pydantic import BaseModel
from pybit.unified_trading import HTTP

from PANEL.settings import redis_history_signals
from app.frontend.models import CustomUser

router = Router(
    tags=['Авторизация'],
)

class LoginSchema(BaseModel):
    username: str
    password: str

class TokenSchema(BaseModel):
    token: str

@router.api_operation(["POST", "OPTIONS"], "/login", auth=NOT_SET)
def login_view(request: HttpRequest, data: LoginSchema):
    if request.method == "OPTIONS":
        return JsonResponse({}, status=200)
    print(request)

    user = authenticate(request, username=data.username, password=data.password)
    if user is None:
        return {"success": False, "error": "Неверный логин или пароль"}

    if user.totp_secret:
        request.session['pre_2fa_user_id'] = user.id
        print("SESSION DATA_login: ", request.session)
        request.session.modified = True
        request.session.save()
        return {"success": True, "2fa_required": True}

    # Только если 2FA не нужен — логиним
    login(request, user)
    return {"success": True, "2fa_required": False}

@router.api_operation(
    ["POST"],
    "/2fa",
    auth=NOT_SET,
)
def two_factor(request: HttpRequest, data: TokenSchema):
    print("SESSION DATA:", request.session.items())
    user_id = request.session.get('pre_2fa_user_id')
    if not user_id:
        return {"success": False, "error": "Сессия истекла, повторите вход"}

    user = CustomUser.objects.get(id=user_id)
    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(data.token):
        login(request, user)
        del request.session['pre_2fa_user_id']
        return {"success": True}
    else:
        return {"success": False, "error": "Неверный 2FA код"}

@router.post('/logout', auth=django_auth)
def logout_view(request: HttpRequest):
    logout(request)
    return {"success": True}

def ms_to_dt(ms):
    ms =  ms / 1000
    dt = datetime.datetime.fromtimestamp(ms, datetime.UTC)
    return dt.strftime('%Y-%m-%d %H:%M:%S')

@router.get('/klines')
def get_klines(
        request: HttpRequest,
        category: str,
        symbol: str,
        interval: str,
        start: Optional[str] = None,
        end: Optional[str] = None

):
    session = HTTP(testnet=False)
    res = session.get_kline(
        category=category,
        symbol=symbol,
        interval=interval,
        limit=1000,
        start=start,
        end=end,
    )
    return res


@router.get('/signals')
def get_signals(
    request: HttpRequest,
    symbol: str = "BTCUSDT",
    interval: str = "1",
    indicator: str = 'FOMO',
):
    pattern = f"{indicator}:{symbol}:{interval}:*"
    keys = list(redis_history_signals.scan_iter(match=pattern, count=1000))
    values = redis_history_signals.mget(keys)
    out = []
    for i in values:
        out.append(json.loads(i))
    return out
