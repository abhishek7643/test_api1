from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import (
    Collection,
    Environment,
    EnvironmentVariable,
    RequestHistory,
    SavedRequest,
)

User = get_user_model()


class CoreDataIsolationTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', email='u1@example.com', password='password123')
        self.user2 = User.objects.create_user(username='user2', email='u2@example.com', password='password123')

        self.col1 = Collection.objects.create(user=self.user1, clerk_user_id='clerk_1', name='User 1 Collection')
        self.col2 = Collection.objects.create(user=self.user2, clerk_user_id='clerk_2', name='User 2 Collection')

        self.req1 = SavedRequest.objects.create(
            user=self.user1,
            clerk_user_id='clerk_1',
            collection=self.col1,
            name='User 1 Request',
            method='GET',
            url='https://api.example.com/data',
        )

        self.env1 = Environment.objects.create(user=self.user1, clerk_user_id='clerk_1', name='Development')
        self.var1 = EnvironmentVariable.objects.create(environment=self.env1, key='BASE_URL', value='https://dev.api.com')

        self.client1 = APIClient()
        self.client1.force_authenticate(user=self.user1)

        self.client2 = APIClient()
        self.client2.force_authenticate(user=self.user2)

    def test_user_can_only_see_own_collections(self):
        resp = self.client1.get('/api/collections/')
        self.assertEqual(resp.status_code, 200)
        names = [c['name'] for c in resp.data]
        self.assertIn('User 1 Collection', names)
        self.assertNotIn('User 2 Collection', names)

    def test_user_cannot_view_other_users_collection(self):
        resp = self.client1.get(f'/api/collections/{self.col2.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_user_cannot_save_request_to_other_users_collection(self):
        payload = {
            'name': 'Malicious Request',
            'collection': self.col2.id,  # belongs to user2
            'method': 'POST',
            'url': 'https://api.example.com/post',
        }
        resp = self.client1.post('/api/saved-requests/', payload, format='json')
        self.assertEqual(resp.status_code, 201)
        # Server-side validation should have cleared or nullified collection
        self.assertIsNone(resp.data['collection'])

    def test_environment_and_variable_isolation(self):
        resp = self.client1.get('/api/environments/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['name'], 'Development')

        # User 2 shouldn't see user 1's environment
        resp2 = self.client2.get('/api/environments/')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(resp2.data), 0)

    def test_request_history_creation_and_size(self):
        entry = RequestHistory.objects.create(
            user=self.user1,
            clerk_user_id='clerk_1',
            method='GET',
            url='https://api.example.com/test',
            status_code=200,
            response_time_ms=120,
            response_size_bytes=1024,
        )
        self.assertEqual(entry.response_size_bytes, 1024)
        self.assertEqual(str(entry.status_code), '200')
