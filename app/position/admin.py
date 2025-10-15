from django.contrib import admin
from fsm_admin2.admin import FSMTransitionMixin

from app.position.models import PositionModel



@admin.register(PositionModel)
class PositionAdmin(FSMTransitionMixin, admin.ModelAdmin):
    list_display = (
        'symbol',
        'status',
    )