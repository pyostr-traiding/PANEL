from django.contrib import admin
from app.users.models import TelegramUserModel, BotPermissionModel

# Inline для прав доступа
class BotPermissionInline(admin.TabularInline):
    model = BotPermissionModel
    can_delete = False         # запрет на удаление
    extra = 0                  # не добавлять пустые формы
    max_num = 1                # максимум 1 запись на пользователя
    verbose_name = "Права доступа"
    verbose_name_plural = "Права доступа"
    classes = ('collapse',)    # <-- свернуть блок по умолчанию

# Основной админ для TelegramUser
@admin.register(TelegramUserModel)
class TelegramUserModelAdmin(admin.ModelAdmin):
    list_display = (
        'chat_id',
        'username',
        'id',
    )

    search_fields = (
        'chat_id',
        'username',
    )

    inlines = [BotPermissionInline]

