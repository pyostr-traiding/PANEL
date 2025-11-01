
from ninja_extra import NinjaExtraAPI

#####
# Ордера
from app.order.routes.base import router as router_order_base
from app.order.routes.crediting import router as router_order_crediting
from app.order.routes.extremum import router as router_order_extremum
from app.order.routes.status import router as router_order_status
from app.P2P.fake_check.api import router as router_fake_p2p

#####
# Позиции
from app.position.routes.base import router as router_position_base
from app.position.routes.status import router as router_position_status

# Импорт роутеров из других модулей
from app.users.api import router as router_users

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

#####
# Позиции
api_route.add_router('/position/', router_position_base)
api_route.add_router('/position/', router_position_status)

#####
# Ордера
api_route.add_router('/order/', router_order_base)
api_route.add_router('/order/', router_order_status)
api_route.add_router('/order/', router_order_crediting)
api_route.add_router('/order/', router_order_extremum)
