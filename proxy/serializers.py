import json

from rest_framework import serializers

from core.models import AUTH_TYPE_CHOICES, METHOD_CHOICES
from core.serializers import clean_and_validate_url


class ProxyExecuteRequestSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=METHOD_CHOICES)
    url = serializers.CharField()
    params = serializers.JSONField(default=dict)
    headers = serializers.JSONField(default=dict)
    body = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    auth_type = serializers.ChoiceField(choices=AUTH_TYPE_CHOICES, default='none')
    auth_config = serializers.JSONField(default=dict)

    def validate_url(self, value):
        return clean_and_validate_url(value)

    def validate_body(self, value):
        if value is None:
            return ''
        if isinstance(value, str):
            return value
        try:
            return json.dumps(value)
        except (TypeError, ValueError):
            return str(value)

    def validate(self, data):
        auth_type = data.get('auth_type', 'none')
        auth_config = data.get('auth_config', {})

        if auth_type == 'bearer':
            if 'token' not in auth_config:
                raise serializers.ValidationError(
                    {'auth_config': 'token is required for bearer auth'},
                    code='invalid_auth_config',
                )
        elif auth_type == 'api_key':
            required_keys = {'key', 'value', 'in'}
            if not required_keys.issubset(set(auth_config.keys())):
                raise serializers.ValidationError(
                    {'auth_config': 'key, value, and in are required for api_key auth'},
                    code='invalid_auth_config',
                )
            if auth_config.get('in') not in ('header', 'query'):
                raise serializers.ValidationError(
                    {'auth_config': "in must be one of 'header' or 'query'"},
                    code='invalid_auth_config',
                )
        elif auth_type == 'basic':
            required_keys = {'username', 'password'}
            if not required_keys.issubset(set(auth_config.keys())):
                raise serializers.ValidationError(
                    {'auth_config': 'username and password are required for basic auth'},
                    code='invalid_auth_config',
                )

        body = data.get('body')
        headers = data.get('headers', {})

        if body:
            content_type = ''
            for k, v in headers.items():
                if isinstance(k, str) and k.lower() == 'content-type':
                    content_type = v if isinstance(v, str) else str(v)
                    break
            if 'application/json' in content_type.lower():
                try:
                    json.loads(body)
                except (json.JSONDecodeError, TypeError, ValueError):
                    raise serializers.ValidationError(
                        {'body': 'invalid_json_body'},
                        code='invalid_json_body',
                    )

        return data
