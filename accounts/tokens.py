from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.crypto import constant_time_compare
from django.utils.http import base36_to_int


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """
    Token generator for email activation.
    Includes user.is_active and user.email in the hash so that:
    1. Once an account is activated (is_active becomes True), the token is permanently invalidated.
    2. The token cannot be reused.
    3. The token expires after EMAIL_VERIFICATION_TIMEOUT (default 24 hours).
    """
    key_salt = "accounts.tokens.EmailVerificationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.is_active}{user.email}{timestamp}"

    def check_token(self, user, token):
        if not (user and token):
            return False

        try:
            ts_b36, _ = token.split("-")
        except ValueError:
            return False

        try:
            ts = base36_to_int(ts_b36)
        except ValueError:
            return False

        for secret in [self.secret, *self.secret_fallbacks]:
            if constant_time_compare(
                self._make_token_with_timestamp(user, ts, secret),
                token,
            ):
                break
        else:
            return False

        timeout = getattr(settings, "EMAIL_VERIFICATION_TIMEOUT", 86400)
        if (self._num_seconds(self._now()) - ts) > timeout:
            return False

        return True


email_verification_token = EmailVerificationTokenGenerator()
