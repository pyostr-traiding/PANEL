from django.apps import AppConfig


class FakeCheckConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app.P2P.fake_check'
