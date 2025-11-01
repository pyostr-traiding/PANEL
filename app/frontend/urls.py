from django.urls import path

from app.frontend.views import (
    IndicatorCandlesView,
    IndicatorChartView,
    IndicatorDataView,
    IndicatorRSIView,
)

urlpatterns = [

    path('chart/', IndicatorChartView.as_view(), name='indicator_chart'),

    path('data/', IndicatorDataView.as_view(), name='indicator_data'),

    path('candles/', IndicatorCandlesView.as_view(), name='indicator_candles'),
    path('rsi/', IndicatorRSIView.as_view(), name='indicator_rsi'),

]
