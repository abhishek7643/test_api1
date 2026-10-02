from http import HTTPStatus
import ipaddress
import json
import logging
import os
import re
import socket
from time import perf_counter
from urllib.parse import urlsplit

import requests
from requests.auth import HTTPBasicAuth
from requests.exceptions import (
    ConnectionError,
    RequestException,
    SSLError,
    Timeout,
    TooManyRedirects,
)

logger = logging.getLogger(__name__)

MAX_RESPONSE_SIZE = int(os.getenv('PROXY_MAX_RESPONSE_SIZE', str(5 * 1024 * 1024)))  # 5MB


class SSRFProtectionError(ValueError):
    """Raised when a request target violates SSRF protection policies."""
    pass


def is_ssrf_safe_ip(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
        # Block cloud metadata addresses like 169.254.169.254
        if str(ip) in ('169.254.169.254', '169.254.170.2'):
            return False
        return True
    except ValueError:
        return False


def validate_target_url(url, allow_localhost_dev=False):
    """
    Validates URL and checks against SSRF threats.
    Blocks private IP ranges, loopback, link-local, and cloud metadata endpoints.
    """
    if not url or not isinstance(url, str):
        raise ValueError("A valid URL is required.")

    url = url.strip()
    split = urlsplit(url)

    if split.scheme.lower() not in ('http', 'https'):
        raise ValueError("URL must use HTTP or HTTPS protocol.")

    hostname = split.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname.")

    hostname_lower = hostname.lower()

    # Block well-known cloud metadata hostnames
    if hostname_lower in ('metadata.google.internal', 'instance-data', '169.254.169.254'):
        raise SSRFProtectionError("Access to cloud metadata endpoints is strictly blocked.")

    # Allow localhost only if explicitly enabled in local dev settings
    if allow_localhost_dev:
        if hostname_lower in ('localhost', '127.0.0.1', '::1'):
            return True

    # Check for direct IP in hostname
    try:
        ip = ipaddress.ip_address(hostname_lower)
        if not is_ssrf_safe_ip(str(ip)):
            raise SSRFProtectionError("Target IP address is within a restricted private or loopback range.")
        return True
    except ValueError:
        pass  # Hostname is a domain name, proceed to DNS resolution

    # Resolve domain to IP addresses and verify none are private/loopback
    port = split.port or (443 if split.scheme.lower() == 'https' else 80)
    try:
        addr_info = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
        for entry in addr_info:
            ip_str = entry[4][0]
            if not is_ssrf_safe_ip(ip_str):
                raise SSRFProtectionError(f"Target host '{hostname}' resolves to restricted IP: {ip_str}.")
    except socket.gaierror as e:
        logger.debug("DNS lookup failed for %s: %s", hostname, e)
        # We allow requests to proceed to requests.request to catch standard DNS resolution errors

    return True


def apply_auth(auth_type, auth_config, params_dict, headers_dict):
    final_params = dict(params_dict) if params_dict else {}
    final_headers = dict(headers_dict) if headers_dict else {}
    basic_auth = None

    if auth_type == 'bearer':
        token = auth_config.get('token', '')
        if token:
            final_headers['Authorization'] = f'Bearer {token}'
    elif auth_type == 'api_key':
        key = auth_config.get('key', '')
        value = auth_config.get('value', '')
        location = auth_config.get('in', 'header')
        if key:
            if location == 'header':
                final_headers[key] = value
            elif location == 'query':
                final_params[key] = value
    elif auth_type == 'basic':
        username = auth_config.get('username', '')
        password = auth_config.get('password', '')
        basic_auth = HTTPBasicAuth(username, password)
    elif auth_type == 'oauth2':
        token = auth_config.get('access_token', '') or auth_config.get('token', '')
        if token:
            header_prefix = auth_config.get('header_prefix', 'Bearer')
            final_headers['Authorization'] = f'{header_prefix} {token}'

    return final_params, final_headers, basic_auth


def execute_request(method, url, params, headers, body, auth_type, auth_config, timeout=30):
    result = {
        'ok': False,
        'status_code': None,
        'status_text': '',
        'response_time_ms': None,
        'response_size_bytes': 0,
        'headers': {},
        'cookies': [],
        'body_text': '',
        'content_type': '',
        'error_type': None,
        'error_message': None,
        'is_truncated': False,
    }

    method = method.upper() if method else 'GET'
    allow_localhost = os.getenv('ALLOW_LOCALHOST_PROXY', 'True').lower() in ('true', '1', 'yes')

    # SSRF Protection & URL Validation
    try:
        validate_target_url(url, allow_localhost_dev=allow_localhost)
    except SSRFProtectionError as e:
        result['status_text'] = 'Blocked (SSRF)'
        result['error_type'] = 'ssrf_blocked'
        result['error_message'] = str(e)
        return result
    except ValueError as e:
        result['status_text'] = 'Invalid URL'
        result['error_type'] = 'invalid_url'
        result['error_message'] = str(e)
        return result

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
        'stream': True,
    }

    if basic_auth is not None:
        request_kwargs['auth'] = basic_auth

    # Handle Request Body for methods that support body
    if body and method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        content_type = ''
        for k, v in final_headers.items():
            if k.lower() == 'content-type':
                content_type = str(v)
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
        with requests.request(**request_kwargs) as resp:
            # Read response content safely up to MAX_RESPONSE_SIZE
            raw_chunks = []
            total_bytes = 0
            is_truncated = False

            for chunk in resp.iter_content(chunk_size=8192):
                if total_bytes + len(chunk) > MAX_RESPONSE_SIZE:
                    remaining = MAX_RESPONSE_SIZE - total_bytes
                    if remaining > 0:
                        raw_chunks.append(chunk[:remaining])
                        total_bytes += remaining
                    is_truncated = True
                    break
                raw_chunks.append(chunk)
                total_bytes += len(chunk)

            raw_body = b''.join(raw_chunks)
            elapsed = perf_counter() - start

            encoding = resp.encoding or 'utf-8'
            try:
                body_text = raw_body.decode(encoding, errors='replace')
            except Exception:
                body_text = raw_body.decode('utf-8', errors='replace')

            # Status description
            try:
                status_text = HTTPStatus(resp.status_code).phrase
            except Exception:
                status_text = 'OK' if resp.status_code < 400 else 'Error'

            # Parse cookies
            cookies_list = []
            for c in resp.cookies:
                cookies_list.append({
                    'name': c.name,
                    'value': c.value,
                    'domain': c.domain or '',
                    'path': c.path or '/',
                    'secure': c.secure or False,
                    'expires': getattr(c, 'expires', None),
                })

            result['ok'] = resp.status_code < 400
            result['status_code'] = resp.status_code
            result['status_text'] = status_text
            result['response_time_ms'] = int(elapsed * 1000)
            result['response_size_bytes'] = total_bytes
            result['headers'] = dict(resp.headers)
            result['cookies'] = cookies_list
            result['body_text'] = body_text
            result['content_type'] = resp.headers.get('Content-Type', '')
            result['is_truncated'] = is_truncated

    except ConnectionError as e:
        result['status_text'] = 'Connection Failed'
        result['error_type'] = 'connection_error'
        result['error_message'] = f"Unable to reach the target API: {str(e)}"
    except Timeout as e:
        result['status_text'] = 'Timed Out'
        result['error_type'] = 'timeout'
        result['error_message'] = f"The request timed out after {timeout} seconds."
    except TooManyRedirects as e:
        result['status_text'] = 'Too Many Redirects'
        result['error_type'] = 'too_many_redirects'
        result['error_message'] = "Too many redirects encountered while reaching destination."
    except SSLError as e:
        result['status_text'] = 'SSL Error'
        result['error_type'] = 'ssl_error'
        result['error_message'] = f"SSL/TLS Certificate verification failed: {str(e)}"
    except RequestException as e:
        result['status_text'] = 'Request Error'
        result['error_type'] = 'request_error'
        result['error_message'] = str(e)
    except Exception as e:
        logger.error("Unexpected error in proxy execution: %s", e, exc_info=True)
        result['status_text'] = 'Execution Error'
        result['error_type'] = 'execution_error'
        result['error_message'] = "An unexpected error occurred during request proxying."

    return result
