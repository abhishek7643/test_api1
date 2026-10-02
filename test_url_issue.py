import requests
import json

BASE = 'http://127.0.0.1:8000'

def run_tests():
    session = requests.Session()
    # Login
    try:
        r = session.get(BASE + '/accounts/login/')
    except Exception as e:
        print('Server not running:', e)
        return
    csrf = session.cookies.get('csrftoken', '')
    login_data = {
        'username': 'testuser',
        'password': 'testpass123',
        'csrfmiddlewaretoken': csrf,
    }
    session.post(
        BASE + '/accounts/login/',
        data=login_data,
        headers={'Referer': BASE + '/accounts/login/'}
    )

    # Test various URL formats
    test_urls = [
        'https://jsonplaceholder.typicode.com/users',
        ' https://jsonplaceholder.typicode.com/users',
        'https://jsonplaceholder.typicode.com/users ',
        'GET https://jsonplaceholder.typicode.com/users',
        'https://jsonplaceholder.typicode.com/users\n',
    ]

    csrf2 = session.cookies.get('csrftoken', '')
    for i, url in enumerate(test_urls):
        print()
        print('=== Test', i+1, ': URL =', repr(url), '===')
        payload = {
            'method': 'GET',
            'url': url,
            'params': {},
            'headers': {},
            'body': '',
            'auth_type': 'none',
            'auth_config': {}
        }
        r = session.post(
            BASE + '/api/proxy/execute/',
            json=payload,
            headers={'X-CSRFToken': csrf2, 'Referer': BASE + '/'}
        )
        print('HTTP', r.status_code)
        try:
            data = r.json()
            print('  ok:', data.get('ok'))
            if not data.get('ok'):
                print('  error_message:', data.get('error_message'))
        except Exception as e:
            print('  parse error:', e)
            print('  body:', r.text[:300])

if __name__ == '__main__':
    run_tests()

