from time import perf_counter
import json

import requests
from requests.auth import HTTPBasicAuth
from requests.exceptions import (
    ConnectionError,
    RequestException,
    SSLError,
    Timeout,
    TooManyRedirects,
)


def apply_auth(auth_type, auth_config, params_dict, headers_dict):
    final_params = dict(params_dict) if params_dict else {}
    final_headers = dict(headers_dict) if headers_dict else {}
    basic_auth = None

    if auth_type == 'bearer':
        token = auth_config.get('token', '')
        final_headers['Authorization'] = f'Bearer {token}'
    elif auth_type == 'api_key':
        key = auth_config.get('key', '')
        value = auth_config.get('value', '')
        location = auth_config.get('in', 'header')
        if location == 'header':
            final_headers[key] = value
        elif location == 'query':
            final_params[key] = value
    elif auth_type == 'basic':
        username = auth_config.get('username', '')
        password = auth_config.get('password', '')
        basic_auth = HTTPBasicAuth(username, password)

    return final_params, final_headers, basic_auth


def execute_request(method, url, params, headers, body, auth_type, auth_config, timeout):
    result = {
        'ok': False,
        'status_code': None,
        'response_time_ms': None,
        'headers': None,
        'body_text': None,
        'content_type': None,
        'error_type': None,
        'error_message': None,
    }

    final_params, final_headers, basic_auth = apply_auth(
        auth_type, auth_config, params, headers
    )

    request_kwargs = {
        'method': method,
        'url': url,
        'params': final_params,
        'headers': final_headers,
        'timeout': timeout,
        'allow_redirects': True,
    }

    if basic_auth is not None:
        request_kwargs['auth'] = basic_auth

    if body:
        content_type = ''
        for k, v in final_headers.items():
            if k.lower() == 'content-type':
                content_type = v if isinstance(v, str) else str(v)
                break
        if 'application/json' in content_type.lower():
            try:
                parsed_body = json.loads(body) if isinstance(body, str) else body
                request_kwargs['json'] = parsed_body
            except (json.JSONDecodeError, TypeError, ValueError):
                request_kwargs['data'] = body
        else:
            request_kwargs['data'] = body

    start = perf_counter()
    try:
        resp = requests.request(**request_kwargs)
        elapsed = perf_counter() - start
        result['ok'] = True
        result['status_code'] = resp.status_code
        result['response_time_ms'] = int(elapsed * 1000)
        result['headers'] = dict(resp.headers)
        result['body_text'] = resp.text
        result['content_type'] = resp.headers.get('Content-Type', None)
    except ConnectionError as e:
        result['error_type'] = 'connection_error'
        result['error_message'] = str(e)
    except Timeout as e:
        result['error_type'] = 'timeout'
        result['error_message'] = str(e)
    except TooManyRedirects as e:
        result['error_type'] = 'too_many_redirects'
        result['error_message'] = str(e)
    except SSLError as e:
        result['error_type'] = 'ssl_error'
        result['error_message'] = str(e)
    except UnicodeError as e:
        result['error_type'] = 'invalid_url'
        result['error_message'] = str(e)
    except RequestException as e:
        msg = str(e).lower()
        if 'url' in msg or 'invalid' in msg:
            result['error_type'] = 'invalid_url'
        else:
            result['error_type'] = 'request_error'
        result['error_message'] = str(e)

    return result
