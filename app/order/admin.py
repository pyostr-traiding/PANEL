import json
from decimal import Decimal, ROUND_DOWN

from django.contrib import admin
from django.contrib.admin import TabularInline
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from fsm_admin2.admin import FSMTransitionMixin

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.order.models import OrderModel, OrderHistoryModel, OrderCreditingModel


class OrderHistoryModelAdmin(TabularInline):
    model = OrderHistoryModel
    extra = 0
    readonly_fields = ('formatted_update_data', 'action_name', 'comment')
    fields = ('action_name', 'formatted_update_data', 'comment')
    ordering = ('-created_at', )

    def has_add_permission(self, request, obj):
        return False

    @admin.display(description="Данные обновления (JSON)")
    def formatted_update_data(self, obj):
        if not obj.update_data:
            return "-"
        pretty_json = json.dumps(obj.update_data, indent=4, ensure_ascii=False)
        return mark_safe(f"<pre>{pretty_json}</pre>")

class OrderCreditingModelAdmin(admin.TabularInline):
    model = OrderCreditingModel
    extra = 0
    readonly_fields = ('type', 'count_display', 'comment')
    fields = readonly_fields
    ordering = ('-created_at', )

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Кол-во (округл.)')
    def count_display(self, obj):
        """
        Отображает значение count с округлением до 3 знаков,
        а при наведении показывает полное число.
        """
        if obj.count is None:
            return "-"

        full_value = str(obj.count)
        short_value = obj.count.quantize(Decimal('0.001'), rounding=ROUND_DOWN)

        return format_html(
            '<span title="{}">{}</span>',
            full_value,
            short_value
        )
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

    inlines = [
        OrderCreditingModelAdmin,
        OrderHistoryModelAdmin,
    ]

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