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
    template_name = 'html/base_indicator.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['path'] = self.request.path
        return ctx

class IndicatorRSIView(IndicatorBaseView):
    """Вкладка с RSI и Stoch RSI"""
    template_name = 'html/indicator_rsi.html'

class IndicatorCandlesView(IndicatorBaseView):
    template_name = 'html/indicator_candles.html'

class IndicatorChartView(TemplateView):
    template_name = 'html/chart/indicator_chart.html'

# class DocumentationView(TemplateView):
#     template_name = 'html/documentation.html'
#
#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#
#         # Получаем все документы
#         docs_qs = DocumentationModel.objects.all()
#
#         # Сгруппируем по категориям
#         docs = defaultdict(list)
#         for doc in docs_qs:
#             docs[doc.category].append(doc)
#
#         # Отсортируем внутри категорий, чтобы "Введение" было первым (если есть)
#         for category, docs_list in docs.items():
#             docs_list.sort(key=lambda d: (0 if d.title == "Введение" else 1, d.title))
#
#         context['docs'] = dict(docs)
#
#         doc_id = self.kwargs.get('doc_id')
#
#         if not doc_id:
#             # Если не указан doc_id, ищем документ с названием "Введение"
#             intro_doc = docs_qs.filter(title="Введение").first()
#             if intro_doc:
#                 doc_id = intro_doc.id
#
#         context['selected_id'] = doc_id
#         context['readme_html'] = ""
#
#         if doc_id:
#             doc = get_object_or_404(DocumentationModel, id=doc_id)
#             context['selected_doc'] = doc
#
#             try:
#                 token = os.getenv('GITHUB_AUTH_TOKEN')
#                 headers = {
#                     'Authorization': f'token {token}' if token else '',
#                     'Accept': 'application/vnd.github.v3.raw'
#                 }
#                 response = requests.get(doc.url, headers=headers)
#                 if response.status_code == 404:
#                     context['readme_html'] = "<p style='color:red'>Ошибка: Документ не найден.</p>"
#                 else:
#                     response.raise_for_status()
#                     md_text = response.text
#                     if not md_text:
#                         context['readme_html'] = "<p style='color:red'>Документ пуст</p>"
#                     else:
#                         context['readme_html'] = markdown(md_text)
#             except Exception as e:
#                 context['readme_html'] = f"<p style='color:red'>Ошибка: {e}</p>"
#
#         return context


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
    return render(request, 'html/login.html', {'form': form})

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

    return render(request, 'html/setup_2fa.html', {
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

    return render(request, 'html/two_factor.html', {'form': form})