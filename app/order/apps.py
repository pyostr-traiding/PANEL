from django.apps import AppConfig


class OrderConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app.order'

    def ready(self):
        from app.order.signals import crediting, history, profit, order_change
