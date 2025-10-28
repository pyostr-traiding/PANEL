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
    class Media:
        js = (
            'js/admin_order_ws.js',
            'js/admin_order_init.js',
            'js/admin_order_extremum.js',
            'js/admin_order_live_info.js',
            'js/admin_order_lifetime.js',
        )
        css = {
            'all': ('css/admin_order.css',)
        }
    change_list_template = "html/change_list.html"

    search_fields = (
        'uuid',
    )
    list_filter = (
        'status',
    )
    list_display = (
        'open_block',
        'position_info',
        'position_live_data',
        'redis_value',
    )
    inlines = [
        OrderCreditingModelAdmin,
        OrderHistoryModelAdmin,
    ]

    @admin.display(description='')
    def open_block(self, obj):
        return 'Открыть'

    @admin.display(description='Инфо')
    def position_info(self, obj: OrderModel):
        if not obj.pk:
            return "-"

        price = Decimal(obj.price)
        qty = Decimal(obj.qty_tokens)
        value = price * qty
        rounded_usdt = value.quantize(Decimal('0.01'))
        side = 'ЛОНГ' if obj.side == 'buy' else 'ШОРТ'
        created_at = obj.created_at.isoformat()
        html = f"""
        <table style="border-collapse: collapse; width: 100%; border: none;">
            <tr><td style="text-align: left; padding-right: 10px;">Вход:</td><td>{price}</td></tr>
            <tr><td style="text-align: left; padding-right: 10px;">Сторона:</td><td>{side}</td></tr>
            <tr><td style="text-align: left; padding-right: 10px;">Кол-во:</td><td>{qty}</td></tr>
            <tr><td style="text-align: left; padding-right: 10px;">USDT:</td><td>{rounded_usdt}</td></tr>
              <tr>
                <td style="text-align: left; padding-right: 10px;">Времени от создания:</td>
                <td class="js-lifetime" data-created-at="{created_at}">—</td>
            </tr>
        </table>
        """
        return mark_safe(html)

    @admin.display(description='Актуальные данные')
    def position_live_data(self, obj: OrderModel):
        if not obj.pk:
            return "-"

        percent_profit = 0.1
        entry_price = Decimal(obj.price)
        qty = Decimal(obj.qty_tokens)
        funding = Decimal(obj.accumulated_funding)
        side = obj.side.lower()
        symbol = obj.position.symbol.name

        price_span_id = f'curprice-{obj.pk}'
        pnl_span_id = f'pnl-{obj.pk}'
        indicator_id = f'socket-indicator-{obj.pk}'
        url = f"/api/order/?uuid={obj.uuid}"

        html = f"""
        <div style="position: relative;"
             class="js-live-block"
             data-url="{url}"
             data-symbol="{symbol}"
             id="live-block-{obj.uuid}">


            <!-- Обратный отсчёт -->
            <div class="js-refresh-counter"
                 style="position:absolute; top:2px; right:4px; font-size:10px; color:gray;">
                5с
            </div>

            <table style="border-collapse: collapse; width: 100%; border: none;">
                <tr>
                    <td style="text-align: left; padding-right: 10px;">Сборы USDT:</td>
                    <td class="js-funding">{funding.quantize(Decimal('0.001'))}</td>
                </tr>
                <tr>
                    <td style="text-align: left; padding-right: 10px;">Цель для {percent_profit}%:</td>
                    <td>{obj.target_price_for_profit(1).quantize(Decimal('0.001'))}</td>
                </tr>
                <tr>
                    <td style="text-align: left; padding-right: 10px;">Статус:</td>
                    <td class="js-status">{obj.get_status_display().upper()}</td>
                </tr>
                <tr>
                    <td style="text-align: left; padding-right: 10px;">Курс:</td>
                    <td><span id="{price_span_id}" class="js-current-price" data-symbol="{symbol}">—</span></td>
                </tr>
                <tr>
                    <td style="text-align: left; padding-right: 10px;">P&L:</td>
                    <td>
                        <span
                            id="{pnl_span_id}"
                            class="js-pnl"
                            data-entry-price="{entry_price}"
                            data-qty="{qty}"
                            data-funding="{funding}"
                            data-side="{side}"
                            data-symbol="{symbol}"
                        >—</span>
                    </td>
                </tr>
            </table>
        </div>
        """
        return mark_safe(html)

    @admin.display(description='Макс/Мин экстремумы')
    def redis_value(self, obj):
        if not obj.pk:
            return "-"

        url = f"/api/order/extremum?uuid={obj.uuid}"

        html = f"""
        <div class="js-extremum-block"
             data-url="{url}"
             id="extremum-{obj.uuid}"
             style="position:relative;">
            <div style="position:absolute; top:0; right:0; font-size:10px; color:gray;">
                <span class="js-ext-counter">5</span>с
            </div>
         

            <table style="border-collapse: collapse; width: 100%; border: none;">
                <tr>
                    <td style="text-align: left; padding-right: 10px;">МАКС:</td>
                    <td class="js-ext-max">—</td>
                    <td class="js-ext-max-dt">—</td>
                </tr>
                <tr>
                    <td style="text-align: left; padding-right: 10px;">МИН:</td>
                    <td class="js-ext-min">—</td>
                    <td class="js-ext-min-dt">—</td>
                </tr>
  
            </table>
        </div>
        """
        return mark_safe(html)