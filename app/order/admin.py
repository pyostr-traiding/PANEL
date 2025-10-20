from django.contrib import admin

from app.order.models import OrderModel


@admin.register(OrderModel)
class OrderModelAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'uuid',
        'position',
        'symbol',
        'side',
        'price',
        'qty_tokens',
        'is_test',
        'created_at',
    )
    list_filter = ('side', 'category', 'is_test')
    search_fields = ('uuid', 'position__uuid', 'symbol__name')
