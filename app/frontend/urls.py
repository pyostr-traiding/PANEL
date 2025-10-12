from django.urls import path

from ..sockets import consumers
from .views import DocumentationView

urlpatterns = [

    path('list/', DocumentationView.as_view(), name='doc-list'),  # список без выбранного
    path('list/<int:doc_id>/', DocumentationView.as_view(), name='doc-detail'),  # конкретный документ по id
]
