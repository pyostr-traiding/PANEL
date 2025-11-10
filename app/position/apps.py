from django.apps import AppConfig


class PositionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app.position'
    verbose_name = 'Позиции'

    def ready(self):
        from app.position.signals import position_change
