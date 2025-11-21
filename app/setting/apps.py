from django.apps import AppConfig


class SettingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app.setting'
    verbose_name = 'Настройки'


    def ready(self):
        from app.setting.signals import redis, indicator, settings
