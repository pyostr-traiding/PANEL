from django.contrib import admin
from fsm_admin2.admin import FSMTransitionMixin

from app.position.models import PositionModel



@admin.register(PositionModel)
class PositionAdmin(admin.ModelAdmin, FSMTransitionMixin):
    list_filter = (
        'symbol',
        'status',
    )
    list_display = (
        'symbol',
        'status',
        'side',
        'price',
        'is_test',
    )
    autocomplete_fields = (
        'symbol',
    )
