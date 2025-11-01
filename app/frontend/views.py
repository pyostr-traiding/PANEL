import base64
import io

import pyotp
import qrcode
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.views.generic import TemplateView

from app.frontend.models import CustomUser
from django.contrib.auth import authenticate, login
from django.shortcuts import render, redirect
from django import forms
from app.frontend import twofa_state

class IndicatorBaseView(TemplateView):
    """Базовый шаблон для вкладок с индикаторами"""
    template_name = 'html/site/chart/base_indicator.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['path'] = self.request.path
        return ctx

class IndicatorRSIView(IndicatorBaseView):
    """Вкладка с RSI и Stoch RSI"""
    template_name = 'html/site/data/rsi.html'

class IndicatorCandlesView(IndicatorBaseView):
    template_name = 'html/site/data/klines.html'

class IndicatorChartView(TemplateView):
    template_name = 'html/site/chart/indicator_chart.html'

class IndicatorDataView(IndicatorBaseView):
    """Главная страница раздела Данные"""
    template_name = 'html/site/data/main.html'

@login_required
def setup_2fa(request):
    user = request.user
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.save()

    totp_uri = pyotp.totp.TOTP(user.totp_secret).provisioning_uri(name=user.email, issuer_name="MyDjangoAdmin")

    # Генерируем QR-код
    img = qrcode.make(totp_uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_img = buffer.getvalue()

    return HttpResponse(qr_img, content_type="image/png")


class LoginForm(forms.Form):
    username = forms.CharField(initial='pyostr')
    # password = forms.CharField(widget=forms.PasswordInput, initial='www')
    password = forms.CharField(initial='www')

class TwoFactorForm(forms.Form):
    token = forms.CharField(label="2FA код", max_length=6)

def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            user = authenticate(request, username=form.cleaned_data['username'], password=form.cleaned_data['password'])
            if user:
                twofa_state.add_pending_user(user.id)
                return redirect(f'/2fa/?uid={user.id}')
    else:
        form = LoginForm()
    return render(request, 'html/admin/login.html', {'form': form})

@login_required
def setup_2fa(request):
    user = request.user

    # Если секрета нет — создаём
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        user.save()

    # Генерируем URI для Google Authenticator
    totp = pyotp.TOTP(user.totp_secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="MyDjangoAdmin")

    # Генерируем QR-код в память
    qr = qrcode.make(provisioning_uri)
    buffer = io.BytesIO()
    qr.save(buffer, format='PNG')
    qr_b64 = base64.b64encode(buffer.getvalue()).decode()

    return render(request, 'html/admin/setup_2fa.html', {
        'qr_code': qr_b64,
        'secret': user.totp_secret,
    })

def two_factor_view(request):
    user_id = request.GET.get('uid')
    if not user_id:
        return redirect('login')

    try:
        user_id = int(user_id)
        if not twofa_state.is_user_pending(user_id):
            return redirect('login')

        user = CustomUser.objects.get(id=user_id)
    except (ValueError, CustomUser.DoesNotExist):
        return redirect('login')

    if not user.totp_secret:
        login(request, user)
        twofa_state.pop_pending_user(user.id)
        return redirect('/admin/')

    if request.method == 'POST':
        form = TwoFactorForm(request.POST)
        if form.is_valid():
            totp = pyotp.TOTP(user.totp_secret)
            if totp.verify(form.cleaned_data['token']):
                login(request, user)
                request.session.modified = True
                request.session.save()
                twofa_state.pop_pending_user(user.id)
                return redirect('/')
            else:
                form.add_error('token', 'Неверный код')
    else:
        form = TwoFactorForm()

    return render(request, 'html/admin/two_factor.html', {'form': form})