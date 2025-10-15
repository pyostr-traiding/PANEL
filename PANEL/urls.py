from django.contrib import admin
from django.urls import path, include

from PANEL.api import api_route
from app.frontend.views import login_view, two_factor_view, setup_2fa


urlpatterns = [
    path('api/', api_route.urls, name='api_route'),
    # path('docs/', include('app.frontend.urls')),
    path('setup-2fa/', setup_2fa, name='setup_2fa'),
    path('login/', login_view, name='login'),
    path('2fa/', two_factor_view, name='two_factor'),
    path('grappelli/', include('grappelli.urls')),
    path('', admin.site.urls),

]

admin.site.site_header = 'Трейдинг'
admin.site.site_title = 'Трейдинг'
admin.site.index_title = ''
