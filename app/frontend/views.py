from django.views.generic import TemplateView


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

class IndicatorCandlesView(IndicatorBaseView):
    template_name = 'html/site/data/klines.html'

class IndicatorChartView(TemplateView):
    template_name = 'html/site/chart/chart.html'

class IndicatorDataView(IndicatorBaseView):
    """Главная страница раздела Данные"""
    template_name = 'html/site/data/main.html'


class GPTAnalizView(IndicatorBaseView):
    """Главная страница раздела Данные"""
    template_name = 'html/site/GPT/gpt.html'
