import re

from rest_framework import serializers

from core.models import (
    Collection,
    Environment,
    EnvironmentVariable,
    RequestHistory,
    SavedRequest,
)


def clean_and_validate_url(value):
    if isinstance(value, str):
        value = value.strip()
        value = value.strip('"\'')
        value = value.strip()
        value = re.sub(r'[\x00-\x1f\x7f]', '', value)
        value = value.strip()
        method_prefixes = [m + '\\s+' for m in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']]
        pattern = r'^(' + '|'.join(method_prefixes) + r')'
        value = re.sub(pattern, '', value, flags=re.IGNORECASE).strip()
    if not isinstance(value, str):
        raise serializers.ValidationError(
            'URL must start with http:// or https://',
            code='invalid_url'
        )
    lower = value.lower()
    # Allow environment variables in URL (e.g. {{BASE_URL}}/api)
    if '{{' in value:
        return value
    if not (lower.startswith('http://') or lower.startswith('https://')):
        raise serializers.ValidationError(
            'URL must start with http:// or https://',
            code='invalid_url'
        )
    return value


class CollectionSerializer(serializers.ModelSerializer):
    requests_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Collection
        fields = ['id', 'name', 'description', 'clerk_user_id', 'requests_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'clerk_user_id', 'requests_count', 'created_at', 'updated_at']

    def get_requests_count(self, obj):
        return obj.saved_requests.count()


class SavedRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedRequest
        fields = [
            'id',
            'name',
            'collection',
            'clerk_user_id',
            'method',
            'url',
            'params_json',
            'headers_json',
            'body_json',
            'auth_type',
            'auth_config_json',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'clerk_user_id', 'created_at', 'updated_at']

    def validate_url(self, value):
        return clean_and_validate_url(value)


class RequestHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestHistory
        fields = [
            'id',
            'clerk_user_id',
            'method',
            'url',
            'status_code',
            'response_time_ms',
            'response_size_bytes',
            'response_headers_json',
            'executed_at',
            'params_json',
            'headers_json',
            'body_json',
            'auth_type',
            'auth_config_json',
            'error_type',
            'error_message',
        ]
        read_only_fields = tuple(fields)


class EnvironmentVariableSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnvironmentVariable
        fields = ['id', 'environment', 'key', 'value', 'is_secret', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class EnvironmentSerializer(serializers.ModelSerializer):
    variables = EnvironmentVariableSerializer(many=True, read_only=True)

    class Meta:
        model = Environment
        fields = ['id', 'name', 'clerk_user_id', 'variables', 'created_at', 'updated_at']
        read_only_fields = ['id', 'clerk_user_id', 'variables', 'created_at', 'updated_at']

