# C:\Users\Professional\PROJECT\TRAIDING\BACKEND\PANEL\PANEL\api.py

from ninja_extra import NinjaExtraAPI

# Импорт роутеров из других модулей
from app.users.api import router as router_users
from app.P2P.fake_check.api import router as router_fake_p2p

#####
# Позиции
from app.position.routes.position import router as router_position

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
api_route.add_router('/users/', router_users)
api_route.add_router('/receipt/', router_fake_p2p)
api_route.add_router('/position/', router_position)
