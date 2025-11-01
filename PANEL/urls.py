from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

from PANEL import settings
from PANEL.api import api_route

urlpatterns = [
    path('api/', api_route.urls, name='api_route'),
    path('grappelli/', include('grappelli.urls')),

    path('system/', include('app.frontend.urls')),
    path('admin/', admin.site.urls),

    path('favicon.ico', RedirectView.as_view(url='/static/images/favicon.ico')),

]

if settings.DEBUG:
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns

    urlpatterns += staticfiles_urlpatterns()  # ✅ вот это добавь
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = 'Трейдинг'
admin.site.site_title = 'Трейдинг'
admin.site.index_title = ''
