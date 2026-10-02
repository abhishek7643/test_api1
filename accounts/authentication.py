import json
import logging
import os
import time
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.auth import get_user_model
import jwt
from jwt import PyJWKClient
import requests
from rest_framework import authentication, exceptions

logger = logging.getLogger(__name__)
User = get_user_model()

# In-memory cache for JWKS client to avoid refetching on every request
_jwks_clients = {}


def get_clerk_publishable_key():
    return os.getenv('CLERK_PUBLISHABLE_KEY', getattr(settings, 'CLERK_PUBLISHABLE_KEY', ''))


def get_clerk_secret_key():
    return os.getenv('CLERK_SECRET_KEY', getattr(settings, 'CLERK_SECRET_KEY', ''))


def get_clerk_jwks_url():
    explicit_url = os.getenv('CLERK_JWKS_URL', getattr(settings, 'CLERK_JWKS_URL', ''))
    if explicit_url:
        return explicit_url

    pub_key = get_clerk_publishable_key()
    if pub_key and '_' in pub_key:
        try:
            import base64
            # Clerk publishable keys are formatted like: pk_test_<base64> or pk_live_<base64>
            parts = pub_key.split('_', 2)
            raw_encoded = parts[-1].rstrip('$')
            padded = raw_encoded + '=' * ((4 - len(raw_encoded) % 4) % 4)
            frontend_api = base64.b64decode(padded).decode('utf-8').strip()
            if '.' in frontend_api:
                if not frontend_api.startswith('http'):
                    frontend_api = f'https://{frontend_api}'
                return f'{frontend_api.rstrip("/")}/.well-known/jwks.json'
        except Exception as e:
            logger.debug("Failed to derive Clerk JWKS URL from publishable key: %s", e)

    return 'https://api.clerk.com/v1/jwks'


class ClerkAuthentication(authentication.BaseAuthentication):
    """
    Authenticates requests using Clerk JWT tokens (Bearer header or __session cookie),
    with seamless fallback to Django SessionAuthentication for local development and admin panel.
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        token = None

        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
        elif '__session' in request.COOKIES:
            token = request.COOKIES.get('__session', '').strip()

        # If a token is provided, verify it against Clerk
        if token:
            user, clerk_id = self.verify_clerk_token(token)
            request.clerk_user_id = clerk_id
            return (user, token)

        # Check underlying Django request session user
        # Note: Do NOT access `request.user` on DRF's Request wrapper here,
        # because `request.user` calls `self._authenticate()`, which would re-invoke this method
        # and cause RecursionError: maximum recursion depth exceeded.
        django_request = getattr(request, '_request', request)
        django_user = getattr(django_request, 'user', None)

        if django_user and getattr(django_user, 'is_authenticated', False):
            clerk_id = getattr(django_user, 'clerk_user_id', None) or f'local_{django_user.id}'
            request.clerk_user_id = clerk_id
            return (django_user, None)

        # In local development if DEBUG is True and no user is authenticated,
        # provide a seamless dev user fallback so local API testing without Clerk setup works out-of-the-box
        if settings.DEBUG and not get_clerk_publishable_key():
            dev_user, _ = User.objects.get_or_create(
                username='dev_test_user',
                defaults={'email': 'dev@testapi.local', 'is_active': True}
            )
            request.clerk_user_id = 'clerk_dev_user_default'
            return (dev_user, None)

        return None

    def verify_clerk_token(self, token):
        secret_key = get_clerk_secret_key()
        pub_key = get_clerk_publishable_key()
        jwks_url = get_clerk_jwks_url()

        # In dev mode without Clerk keys, decode unverified for local testing
        if not secret_key and not pub_key and settings.DEBUG:
            try:
                unverified = jwt.decode(token, options={"verify_signature": False})
                clerk_id = unverified.get('sub') or 'dev_user'
                email = unverified.get('email', f'{clerk_id}@clerk.local')
                user, _ = User.objects.get_or_create(
                    username=clerk_id,
                    defaults={'email': email, 'is_active': True}
                )
                return user, clerk_id
            except Exception as e:
                logger.warning("Failed unverified JWT decode in dev mode: %s", e)
                raise exceptions.AuthenticationFailed('Invalid token format.')

        try:
            # Use cached PyJWKClient for Clerk's JWKS
            if jwks_url not in _jwks_clients:
                _jwks_clients[jwks_url] = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
            jwks_client = _jwks_clients[jwks_url]

            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_exp": True, "verify_aud": False}
            )
            clerk_id = payload.get('sub')
            if not clerk_id:
                raise exceptions.AuthenticationFailed('Token missing sub (Clerk user ID).')

            # Link or create local User record
            email = payload.get('email', '')
            user, _ = User.objects.get_or_create(
                username=clerk_id,
                defaults={'email': email, 'is_active': True}
            )
            return user, clerk_id
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Clerk session token has expired.')
        except jwt.PyJWTError as e:
            logger.warning("Clerk JWT verification failed: %s", e)
            raise exceptions.AuthenticationFailed(f'Invalid Clerk token: {str(e)}')
        except Exception as e:
            logger.error("Unexpected error verifying Clerk token: %s", e)
            raise exceptions.AuthenticationFailed('Authentication verification error.')
