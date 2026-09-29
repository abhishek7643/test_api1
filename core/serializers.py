import re

from rest_framework import serializers

from core.models import Collection, RequestHistory, SavedRequest


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
    if not (lower.startswith('http://') or lower.startswith('https://')):
        raise serializers.ValidationError(
            'URL must start with http:// or https://',
            code='invalid_url'
        )
    return value


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SavedRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedRequest
        fields = [
            'id',
            'name',
            'collection',
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
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_url(self, value):
        return clean_and_validate_url(value)


class RequestHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestHistory
        fields = [
            'id',
            'method',
            'url',
            'status_code',
            'response_time_ms',
            'executed_at',
            'params_json',
            'headers_json',
            'body_json',
            'auth_type',
            'auth_config_json',
        ]
        read_only_fields = tuple(fields)
