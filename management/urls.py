from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from . import auth_views
from .api import router as api_router


urlpatterns = [
    path('api/auth/register/', auth_views.ThrottledRegisterView.as_view(), name='api-register'),
    path('api/auth/token/', auth_views.ThrottledTokenObtainPairView.as_view(), name='api-token'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('api/auth/password-reset/', auth_views.PasswordResetView.as_view(), name='api-password-reset'),
    path('api/auth/password-reset/confirm/', auth_views.PasswordResetConfirmView.as_view(), name='api-password-reset-confirm'),
    path('api/auth/verify-email/', auth_views.VerifyEmailView.as_view(), name='api-verify-email'),
    path('api/auth/verify-email/resend/', auth_views.ResendVerificationView.as_view(), name='api-verify-email-resend'),
    path('api/health/', auth_views.HealthView.as_view(), name='api-health'),
    path('api/', include(api_router.urls)),
]
