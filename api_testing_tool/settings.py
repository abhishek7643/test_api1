"""
Django settings for api_testing_tool project.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')


def _env_bool(name, default=False):
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ('1', 'true', 'yes', 'on')


def _env_list(name, default=None, sep=','):
    val = os.getenv(name)
    if not val:
        return default or []
    return [s.strip() for s in val.split(sep) if s.strip()]


SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY')
if not SECRET_KEY:
    SECRET_KEY = 'django-insecure-fallback-change-me'
else:
    SECRET_KEY = SECRET_KEY.strip()

DEBUG = _env_bool('DJANGO_DEBUG', _env_bool('DEBUG', False))

if not DEBUG and (not SECRET_KEY or SECRET_KEY.startswith('django-insecure-')):
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set in production environments. "
        "Please configure DJANGO_SECRET_KEY (or SECRET_KEY) in your Vercel Project Environment Variables."
    )

raw_allowed_hosts = _env_list('DJANGO_ALLOWED_HOSTS') or _env_list('ALLOWED_HOSTS')
if raw_allowed_hosts:
    ALLOWED_HOSTS = list(raw_allowed_hosts)
    if not DEBUG and '.vercel.app' not in ALLOWED_HOSTS and not any(h.endswith('.vercel.app') for h in ALLOWED_HOSTS):
        ALLOWED_HOSTS.append('.vercel.app')
else:
    ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '.vercel.app']

raw_csrf_origins = _env_list('DJANGO_CSRF_TRUSTED_ORIGINS') or _env_list('CSRF_TRUSTED_ORIGINS')
if raw_csrf_origins:
    CSRF_TRUSTED_ORIGINS = list(raw_csrf_origins)
    if not DEBUG and 'https://*.vercel.app' not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append('https://*.vercel.app')
else:
    CSRF_TRUSTED_ORIGINS = ['https://*.vercel.app']


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'accounts',
    'core',
    'proxy',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'api_testing_tool.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'accounts.context_processors.clerk_context',
            ],
        },
    },
]

WSGI_APPLICATION = 'api_testing_tool.wsgi.application'


db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')
if db_url:
    import dj_database_url
    ssl_require = _env_bool('DB_SSL_REQUIRE', not DEBUG)
    DATABASES = {
        'default': dj_database_url.parse(db_url, conn_max_age=600, ssl_require=ssl_require)
    }
elif os.getenv('DB_NAME') and os.getenv('DB_USER') and os.getenv('DB_PASSWORD'):
    db_options = {}
    if os.getenv('DB_SSLMODE'):
        db_options['sslmode'] = os.getenv('DB_SSLMODE')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME'),
            'USER': os.getenv('DB_USER'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': os.getenv('DB_HOST', '127.0.0.1'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'OPTIONS': db_options,
        }
    }
else:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        "PostgreSQL database configuration missing. SQLite has been removed. "
        "You must configure DATABASE_URL or DB_NAME, DB_USER, and DB_PASSWORD environment variables."
    )



AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Production Security Headers & Cookies
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/accounts/login/'
LOGIN_URL = '/accounts/login/'

PROXY_TIMEOUT = int(os.getenv('PROXY_TIMEOUT', '30'))

# Clerk Configuration
CLERK_PUBLISHABLE_KEY = os.getenv('CLERK_PUBLISHABLE_KEY', '')
CLERK_SECRET_KEY = os.getenv('CLERK_SECRET_KEY', '')
CLERK_JWKS_URL = os.getenv('CLERK_JWKS_URL', '')

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.ClerkAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# Email Configuration
EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = os.getenv('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587' if _env_bool('EMAIL_USE_TLS', True) else '25'))
EMAIL_USE_TLS = _env_bool('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = _env_bool('EMAIL_USE_SSL', False)
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Test API <noreply@localhost>')
EMAIL_VERIFICATION_TIMEOUT = int(os.getenv('EMAIL_VERIFICATION_TIMEOUT', '86400'))


