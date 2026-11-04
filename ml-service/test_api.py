import os
import unittest
from fastapi.testclient import TestClient
from main import app


class RankingTests(unittest.TestCase):
    def setUp(self):
        os.environ['KUMPUNINJA_ML_KEY'] = 'local-test-key'
        self.client = TestClient(app)
        self.headers = {'X-ML-Key': 'local-test-key'}
        self.body = {'booking_id': 'test-booking', 'candidates': [
            {'provider_id': f'worker-{i}', 'distance_km': i + 1,
             'average_customer_rating': 4.5, 'prior_jobs_completed': 10}
            for i in range(4)]}

    def test_auth(self):
        self.assertEqual(self.client.post('/rank', json=self.body).status_code, 401)

    def test_top_three(self):
        response = self.client.post('/rank', json=self.body, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['booking_id'], 'test-booking')
        self.assertEqual(len(data['top_three']), 3)
        self.assertEqual(len({p['provider_id'] for p in data['top_three']}), 3)
        self.assertEqual([p['rank'] for p in data['top_three']], [1, 2, 3])
        self.assertTrue(all(p['provider_id'] in {'worker-0', 'worker-1', 'worker-2', 'worker-3'} for p in data['top_three']))

    def test_duplicates(self):
        self.body['candidates'][1] = self.body['candidates'][0]
        self.assertEqual(self.client.post('/rank', json=self.body, headers=self.headers).status_code, 422)

    def test_invalid_features(self):
        self.body['candidates'][0]['distance_km'] = -1
        self.assertEqual(self.client.post('/rank', json=self.body, headers=self.headers).status_code, 422)

    def test_health(self):
        self.assertEqual(self.client.get('/health').status_code, 200)


if __name__ == '__main__':
    unittest.main()
