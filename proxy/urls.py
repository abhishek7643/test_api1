from django.urls import include, path

from proxy.views import ProxyExecuteView

app_name = 'proxy'
urlpatterns = [
    path('api/proxy/execute/', ProxyExecuteView.as_view(), name='proxy_execute'),
    path('api/', include(('core.api_urls', 'core_api'))),
]
