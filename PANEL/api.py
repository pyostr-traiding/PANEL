# C:\Users\Professional\PROJECT\TRAIDING\BACKEND\PANEL\PANEL\api.py

from ninja_extra import NinjaExtraAPI

# Импорт роутеров из других модулей
from app.users.api import router as users_router
from app.P2P.fake_check.api import router as fake_p2p_router

# Создание API с уникальным namespace
api_route = NinjaExtraAPI(
    title='API',
    description='API Панели управления',
    app_name='Панель управления',
    csrf=False,
    urls_namespace='panel_api',
    version='1.0.0',
    # auth=GlobalAuth()
)

# Подключение роутеров
api_route.add_router('/users/', users_router)
api_route.add_router('/receipt/', fake_p2p_router)
