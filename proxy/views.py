from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import RequestHistory
from proxy.serializers import ProxyExecuteRequestSerializer
from proxy.services import execute_request


class ProxyExecuteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ProxyExecuteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            first_error = ''
            errors = serializer.errors
            if isinstance(errors, dict):
                for field, messages in errors.items():
                    if isinstance(messages, list) and messages:
                        first_error = f'{field}: {messages[0]}'
                        break
                    elif isinstance(messages, str):
                        first_error = f'{field}: {messages}'
                        break
            return Response(
                {
                    'ok': False,
                    'status_code': status.HTTP_400_BAD_REQUEST,
                    'error_type': 'validation_error',
                    'error_message': first_error or 'Invalid request data',
                    'errors': errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        timeout = getattr(settings, 'PROXY_TIMEOUT', 30)

        try:
            result = execute_request(
                method=data['method'],
                url=data['url'],
                params=data.get('params', {}),
                headers=data.get('headers', {}),
                body=data.get('body', ''),
                auth_type=data.get('auth_type', 'none'),
                auth_config=data.get('auth_config', {}),
                timeout=timeout,
            )
        except Exception as e:
            result = {
                'ok': False,
                'status_code': None,
                'response_time_ms': None,
                'headers': None,
                'body_text': None,
                'content_type': None,
                'error_type': 'execution_error',
                'error_message': str(e),
            }

        history_kwargs = dict(
            user=request.user,
            method=data['method'],
            url=data['url'],
            params_json=data.get('params', {}) or {},
            headers_json=data.get('headers', {}) or {},
            body_json=data.get('body', '') or '',
            auth_type=data.get('auth_type', 'none') or 'none',
            auth_config_json=data.get('auth_config', {}) or {},
            status_code=result['status_code'],
            response_time_ms=result['response_time_ms'],
            error_type=result['error_type'] or '',
            error_message=result['error_message'] or '',
        )
        try:
            RequestHistory.objects.create(**history_kwargs)
        except Exception:
            pass

        return Response(result, status=status.HTTP_200_OK)
