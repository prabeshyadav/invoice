"""Throttled auth endpoints (login, register, email verification, password reset) and the health check."""

from django.contrib.auth.models import User
from django.db import connection
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from . import account
from .api import RegisterView
from .throttling import IdentifierRateThrottle

# Default IP/user/scope throttles plus the per-username/email one.
IDENTIFIER_THROTTLES = [*api_settings.DEFAULT_THROTTLE_CLASSES, IdentifierRateThrottle]


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_scope = 'auth'
    throttle_classes = IDENTIFIER_THROTTLES
    serializer_class = account.VerifiedTokenObtainPairSerializer


class ThrottledRegisterView(RegisterView):
    throttle_scope = 'auth'
    serializer_class = account.VerifiedRegisterSerializer


class _PublicAuthView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'
    serializer_class = None

    def validated(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class PasswordResetView(_PublicAuthView):
    throttle_classes = IDENTIFIER_THROTTLES
    serializer_class = account.EmailSerializer
    message = 'If an account exists for that email, a reset link has been sent.'

    def post(self, request):
        email = self.validated(request)['email']
        for user in User.objects.filter(email__iexact=email, is_active=True):
            if user.has_usable_password():
                account.send_password_reset_email(user)
        # Same answer either way so the endpoint can't be used to find accounts.
        return Response({'detail': self.message})


class PasswordResetConfirmView(_PublicAuthView):
    serializer_class = account.PasswordResetConfirmSerializer

    def post(self, request):
        data = self.validated(request)
        user = data['user']
        user.set_password(data['new_password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'Your password has been reset. You can now sign in.'})


class VerifyEmailView(_PublicAuthView):
    serializer_class = account.VerifyEmailSerializer

    def post(self, request):
        user = self.validated(request)['user']
        user.is_active = True
        user.save(update_fields=['is_active'])
        return Response({'detail': 'Your email is verified. You can now sign in.'})


class ResendVerificationView(_PublicAuthView):
    throttle_classes = IDENTIFIER_THROTTLES
    serializer_class = account.EmailSerializer
    message = 'If that account still needs verifying, a new link has been sent.'

    def post(self, request):
        email = self.validated(request)['email']
        for user in User.objects.filter(email__iexact=email, is_active=False):
            if user.has_usable_password():
                account.send_verification_email(user)
        return Response({'detail': self.message})


class HealthView(APIView):
    """Liveness + DB check for container healthchecks and uptime monitors."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    # Probes run every few seconds; they must not use up the anon rate.
    throttle_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
        except Exception:
            return Response({'status': 'error', 'database': 'unavailable'}, status=503)
        return Response({'status': 'ok'})
