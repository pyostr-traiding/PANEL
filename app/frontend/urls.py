from django.urls import path

from app.frontend.views import IndicatorRSIView, IndicatorCandlesView, IndicatorChartView

urlpatterns = [

    path('indicator/rsi/', IndicatorRSIView.as_view(), name='indicator_rsi'),
    path('indicator/candles/', IndicatorCandlesView.as_view(), name='indicator_candles'),
    path('indicator/chart/', IndicatorChartView.as_view(), name='indicator_chart'),

]
