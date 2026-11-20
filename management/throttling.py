import hashlib

from rest_framework.throttling import SimpleRateThrottle


class IdentifierRateThrottle(SimpleRateThrottle):
    """Limits requests per submitted username or email, whatever the client IP.

    IP limits alone can be dodged by rotating addresses (or a forged
    X-Forwarded-For when no trusted reverse proxy is in front), so login and
    password-reset attempts are also capped per account identifier.
    """

    scope = 'auth_identifier'
    fields = ('username', 'email')

    def get_cache_key(self, request, view):
        data = request.data if hasattr(request.data, 'get') else {}
        for field in self.fields:
            value = data.get(field)
            if isinstance(value, str) and value.strip():
                digest = hashlib.sha256(f'{field}:{value.strip().lower()}'.encode()).hexdigest()
                return self.cache_format % {'scope': self.scope, 'ident': digest}
        return None
