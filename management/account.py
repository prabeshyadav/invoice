"""Account emails and serializers: registration with email verification, password reset."""

from html import unescape

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator, default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.html import strip_tags
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import exceptions, serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .serializers import RegisterSerializer


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Separate salt so a verification token can't be used as a reset token,
    and is_active in the hash so the link stops working once used."""

    key_salt = 'management.account.EmailVerificationTokenGenerator'

    def _make_hash_value(self, user, timestamp):
        return f'{super()._make_hash_value(user, timestamp)}{user.is_active}'


email_verification_token = EmailVerificationTokenGenerator()


def _link(path, user, token):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f'{settings.FRONTEND_URL}{path}?uid={uid}&token={token}'


def _plain_text(html):
    # Unescape so the link in the text part is usable (&amp; -> &).
    lines = unescape(strip_tags(html)).splitlines()
    return '\n'.join(line.strip() for line in lines if line.strip())


def _send(user, subject, template, context):
    html = render_to_string(template, {'user': user, **context})
    email = EmailMultiAlternatives(subject=subject, body=_plain_text(html), to=[user.email])
    email.attach_alternative(html, 'text/html')
    email.send()


def send_verification_email(user):
    _send(user, 'Verify your InvoicePro email', 'email_templates/verify_email.html', {
        'link': _link('/verify-email', user, email_verification_token.make_token(user)),
    })


def send_password_reset_email(user):
    _send(user, 'Reset your InvoicePro password', 'email_templates/password_reset_email.html', {
        'link': _link('/reset-password', user, default_token_generator.make_token(user)),
    })


def user_from_uid(uid):
    try:
        return User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


class VerifiedRegisterSerializer(RegisterSerializer):
    """Email is required (it receives the verification link) and passwords
    go through Django's validators, same as password reset."""

    email = serializers.EmailField()
    verification_required = serializers.SerializerMethodField()

    class Meta(RegisterSerializer.Meta):
        fields = [*RegisterSerializer.Meta.fields, 'verification_required']

    def validate_password(self, value):
        validate_password(value)
        return value

    def get_verification_required(self, user):
        return not user.is_active

    def create(self, validated_data):
        user = super().create(validated_data)
        if settings.EMAIL_VERIFICATION_REQUIRED:
            user.is_active = False
            user.save(update_fields=['is_active'])
            send_verification_email(user)
        return user


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class UidTokenSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    token_generator = None
    invalid_message = 'This link is invalid or has expired.'

    def validate(self, attrs):
        user = user_from_uid(attrs['uid'])
        if user is None or not self.token_generator.check_token(user, attrs['token']):
            raise serializers.ValidationError({'token': self.invalid_message})
        attrs['user'] = user
        return attrs


class VerifyEmailSerializer(UidTokenSerializer):
    token_generator = email_verification_token
    invalid_message = 'This verification link is invalid or has expired.'


class PasswordResetConfirmSerializer(UidTokenSerializer):
    token_generator = default_token_generator
    invalid_message = 'This reset link is invalid or has expired.'
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        try:
            validate_password(attrs['new_password'], attrs['user'])
        except Exception as exc:
            raise serializers.ValidationError({'new_password': list(getattr(exc, 'messages', [str(exc)]))})
        return attrs


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """SimpleJWT rejects inactive users as bad credentials. If the password is
    right but the email isn't verified yet, say so (the caller already proved
    they own the account, so this reveals nothing)."""

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except exceptions.AuthenticationFailed:
            user = User.objects.filter(username=attrs.get(self.username_field)).first()
            if user and not user.is_active and user.check_password(attrs.get('password', '')):
                raise exceptions.AuthenticationFailed(
                    'Please verify your email before signing in.', code='email_not_verified'
                )
            raise
