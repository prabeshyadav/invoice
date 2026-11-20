from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from . import auth_views
from .api import router as api_router


urlpatterns = [
    path('api/auth/register/', auth_views.ThrottledRegisterView.as_view(), name='api-register'),
    path('api/auth/token/', auth_views.ThrottledTokenObtainPairView.as_view(), name='api-token'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('api/health/', auth_views.HealthView.as_view(), name='api-health'),
    path('api/', include(api_router.urls)),
]
