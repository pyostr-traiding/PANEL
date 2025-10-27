from django.contrib import admin
from django.contrib.admin import TabularInline

from PANEL.redis_conf import RedisDB
from PANEL.settings import redis_server
from app.abstractions.admin import AbstractAdmin
from app.setting.models import BanSymbolModel, SymbolModel, ExchangeModel


class BanSymbolModelAdminTabularInline(TabularInline):
    model = BanSymbolModel
    extra = 0
    can_delete = False
    readonly_fields = (
        'key',
        'redis_value',
    )
    fields = ('key', 'value', 'redis_value')  # порядок отображения

    @admin.display(description='Значение в Redis')
    def redis_value(self, obj):
        """
        Возвращает значение из Redis для данной блокировки
        """
        if not obj.pk:
            return "-"  # объект ещё не сохранён
        redis_key = f"settings:{obj.symbol.name}:{obj.key}"
        value = redis_server.get(redis_key, db=RedisDB.settings)
        return value

    def has_add_permission(self, request, obj):
        return False

@admin.register(SymbolModel)
class SymbolModelAdmin(AbstractAdmin):

    inlines = [BanSymbolModelAdminTabularInline]

    list_display = (
        'name',
        'is_active'
    )

    search_fields = (
        'name',
    )
    list_filter = (
        'is_active',
    )

@admin.register(ExchangeModel)
class ExchangeModelAdmin(AbstractAdmin):
    list_display = (
        'name',
        'maker_fee',
        'taker_fee',
        'base_url',
        'id',
    )