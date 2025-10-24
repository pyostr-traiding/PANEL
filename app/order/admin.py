import json

from django.contrib import admin
from django.utils.safestring import mark_safe
from fsm_admin2.admin import FSMTransitionMixin

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.order.models import OrderModel



@admin.register(OrderModel)
class OrderModelAdmin(admin.ModelAdmin, FSMTransitionMixin):
    list_filter = (
        'status',
    )
    list_display = (
        'status',
        'side',
        'price',
        'redis_value',
    )

    @admin.display(description='Макс/Мин экстремумы')
    def redis_value(self, obj):
        if not obj.pk:
            return "-"  # объект ещё не сохранён
        _max = f'extremum:order:{obj.uuid}:MAX'
        _min = f'extremum:order:{obj.uuid}:MIN'

        result = redis_server.mget([_max, _min], db=RedisDB.extremums)
        if not result:
            return '-'
        result = [json.loads(i) if i else None for i in result]
        val_0 = result[0]["value"] if len(result) > 0 and result[0] and "value" in result[0] else "—"
        dt_0 = result[0]["dt"] if len(result) > 0 and result[0] and "dt" in result[0] else "—"

        val_1 = result[1]["value"] if len(result) > 1 and result[1] and "value" in result[1] else "—"
        dt_1 = result[1]["dt"] if len(result) > 1 and result[1] and "dt" in result[1] else "—"

        return mark_safe(
            f'<b>{val_0}</b> | {dt_0}<br>'
            f'<hr>'
            f'<b>{val_1}</b> | {dt_1}<br>'
        )