from django.urls import path

from app.frontend.views import (
    IndicatorCandlesView,
    IndicatorChartView,
    IndicatorDataView,
    IndicatorRSIView,
    GPTAnalizView, ServerView, MonitoringView, SettingsIndicatorView, StatisticView,
)

urlpatterns = [

    path('chart/', IndicatorChartView.as_view(), name='indicator_chart'),

    path('data/', IndicatorDataView.as_view(), name='indicator_data'),

    path('gpt/', GPTAnalizView.as_view(), name='gpt_analiz'),
    path('server/', ServerView.as_view(), name='server'),

    path('candles/', IndicatorCandlesView.as_view(), name='indicator_candles'),
    path('rsi/', IndicatorRSIView.as_view(), name='indicator_rsi'),
    path('monitoring/', MonitoringView.as_view(), name='indicator_monitoring'),
    path('settings_indicator/', SettingsIndicatorView.as_view(), name='settings_indicator'),
    path('statistic/', StatisticView.as_view(), name='statistic'),

]
