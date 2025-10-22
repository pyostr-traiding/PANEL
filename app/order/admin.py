from django.contrib import admin
from fsm_admin2.admin import FSMTransitionMixin

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
    )

    @admin.display(description='Значение в Redis')
    def redis_value(self, obj):
        """
        Возвращает значение из Redis для данной блокировки
        """
        if not obj.pk:
            return "-"  # объект ещё не сохранён
        return '----'
        # redis_key = f"settings:{obj.symbol.name}:{obj.key}"
        # value = redis_server.get(redis_key, db=RedisDB.settings)
        # return value
