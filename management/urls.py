from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .api import RegisterView, router as api_router

urlpatterns = [
    path('api/auth/register/', RegisterView.as_view(), name='api-register'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='api-token'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('api/', include(api_router.urls)),
]
