"""Throttled auth endpoints and the health check."""

from django.db import connection
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .api import RegisterView


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_scope = 'auth'


class ThrottledRegisterView(RegisterView):
    throttle_scope = 'auth'


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
