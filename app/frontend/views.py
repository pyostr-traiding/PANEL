import os

from django.views.generic import TemplateView
from dotenv import load_dotenv

load_dotenv()
class IndicatorBaseView(TemplateView):
    """Базовый шаблон для вкладок с индикаторами"""
    template_name = 'html/site/base_app.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['path'] = self.request.path
        return ctx

class IndicatorRSIView(IndicatorBaseView):
    """Вкладка с RSI и Stoch RSI"""
    template_name = 'html/site/data/rsi.html'

class MonitoringView(IndicatorBaseView):
    """Вкладка с RSI и Stoch RSI"""
    template_name = 'html/site/data/monitoring.html'

class IndicatorCandlesView(IndicatorBaseView):
    template_name = 'html/site/data/klines.html'


class SettingsIndicatorView(IndicatorBaseView):
    """Вкладка с RSI и Stoch RSI"""
    template_name = 'html/site/settings_indicator/main.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["intervals"] = ["1", "5", "15", "30", "60"]
        return ctx

class IndicatorChartView(IndicatorBaseView):
    template_name = 'html/site/chart/chart.html'

class IndicatorDataView(IndicatorBaseView):
    template_name = 'html/site/data/main.html'


class GPTAnalizView(IndicatorBaseView):
    template_name = 'html/site/GPT/gpt.html'


class ServerView(IndicatorBaseView):
    template_name = 'html/site/server/server.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['path'] = self.request.path
        ctx["access_token"] = os.getenv('WS_DOCKER_TOKEN')
        return ctx

class StatisticView(IndicatorBaseView):
    template_name = 'html/site/statistic/statistic.html'
