import os
from django.conf import settings


def clerk_context(request):
    """
    Exposes Clerk publishable key and configuration to templates.
    Never exposes the Clerk Secret Key!
    """
    return {
        'CLERK_PUBLISHABLE_KEY': os.getenv('CLERK_PUBLISHABLE_KEY', getattr(settings, 'CLERK_PUBLISHABLE_KEY', '')),
        'CLERK_SIGN_IN_URL': os.getenv('CLERK_SIGN_IN_URL', '/accounts/login/'),
        'CLERK_SIGN_UP_URL': os.getenv('CLERK_SIGN_UP_URL', '/accounts/register/'),
    }
