from django.conf import settings
from django.db import models


AUTH_TYPE_CHOICES = [
    ('none', 'No Authentication'),
    ('bearer', 'Bearer Token'),
    ('api_key', 'API Key'),
    ('basic', 'Basic Authentication'),
    ('oauth2', 'OAuth 2.0'),
]

METHOD_CHOICES = [
    ('GET', 'GET'),
    ('POST', 'POST'),
    ('PUT', 'PUT'),
    ('PATCH', 'PATCH'),
    ('DELETE', 'DELETE'),
    ('HEAD', 'HEAD'),
    ('OPTIONS', 'OPTIONS'),
]


class Collection(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='collections',
        null=True,
        blank=True,
    )
    clerk_user_id = models.CharField(max_length=128, db_index=True, blank=True, default='')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        indexes = [
            models.Index(fields=['clerk_user_id', '-updated_at']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return self.name


class SavedRequest(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_requests',
        null=True,
        blank=True,
    )
    clerk_user_id = models.CharField(max_length=128, db_index=True, blank=True, default='')
    collection = models.ForeignKey(
        Collection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='saved_requests',
    )
    name = models.CharField(max_length=200)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='GET')
    url = models.TextField()
    params_json = models.JSONField(default=dict, blank=True)
    headers_json = models.JSONField(default=dict, blank=True)
    body_json = models.TextField(blank=True, default='')
    auth_type = models.CharField(max_length=20, choices=AUTH_TYPE_CHOICES, default='none')
    auth_config_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        indexes = [
            models.Index(fields=['clerk_user_id', '-updated_at']),
            models.Index(fields=['clerk_user_id', 'collection', '-updated_at']),
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', 'collection', '-updated_at']),
        ]

    def __str__(self):
        return f'{self.method} {self.name}'


class RequestHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='request_history',
        null=True,
        blank=True,
    )
    clerk_user_id = models.CharField(max_length=128, db_index=True, blank=True, default='')
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    url = models.TextField()
    params_json = models.JSONField(default=dict, blank=True)
    headers_json = models.JSONField(default=dict, blank=True)
    body_json = models.TextField(blank=True, default='')
    auth_type = models.CharField(max_length=20, choices=AUTH_TYPE_CHOICES, default='none')
    auth_config_json = models.JSONField(default=dict, blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    response_time_ms = models.IntegerField(null=True, blank=True)
    response_size_bytes = models.IntegerField(null=True, blank=True, default=0)
    response_headers_json = models.JSONField(default=dict, blank=True)
    error_type = models.CharField(max_length=50, blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-executed_at',)
        indexes = [
            models.Index(fields=['clerk_user_id', '-executed_at']),
            models.Index(fields=['user', '-executed_at']),
        ]
        verbose_name_plural = 'Request history entries'

    def __str__(self):
        status = self.status_code or 'ERR'
        return f'[{self.executed_at:%Y-%m-%d %H:%M}] {self.method} {self.url[:80]} ({status})'


class Environment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='environments',
        null=True,
        blank=True,
    )
    clerk_user_id = models.CharField(max_length=128, db_index=True, blank=True, default='')
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        indexes = [
            models.Index(fields=['clerk_user_id', '-updated_at']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return self.name


class EnvironmentVariable(models.Model):
    environment = models.ForeignKey(
        Environment,
        on_delete=models.CASCADE,
        related_name='variables',
    )
    key = models.CharField(max_length=120)
    value = models.TextField(blank=True, default='')
    is_secret = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('key',)
        indexes = [
            models.Index(fields=['environment', 'key']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['environment', 'key'], name='unique_var_key_per_env'),
        ]

    def __str__(self):
        return f'{self.key}={"***" if self.is_secret else self.value}'

