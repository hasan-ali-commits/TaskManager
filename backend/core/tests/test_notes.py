from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from ..models import DailyNoteItem


class DailyNoteAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='noteuser', password='pass')
        self.client = APIClient()
        self.client.login(username='noteuser', password='pass')
        self.url = '/api/core/notes/'

    def list_notes(self, start, end, today):
        return self.client.get(self.url, {'start': start, 'end': end, 'today': today})

    def test_create_and_list_note_item(self):
        resp = self.client.post(self.url, {'date': '2026-10-20', 'text': 'Buy milk', 'kind': 'SIDE_QUEST'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['original_date'], '2026-10-20')

        resp = self.list_notes('2026-10-20', '2026-10-20', '2026-10-20')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([i['text'] for i in resp.data], ['Buy milk'])

    def test_unchecked_items_roll_over_to_today(self):
        DailyNoteItem.objects.create(user=self.user, date=date(2026, 10, 18), original_date=date(2026, 10, 18), text='Unfinished')
        DailyNoteItem.objects.create(user=self.user, date=date(2026, 10, 18), original_date=date(2026, 10, 18), text='Finished', done=True)

        resp = self.list_notes('2026-10-18', '2026-10-21', '2026-10-21')
        by_text = {i['text']: i for i in resp.data}
        self.assertEqual(by_text['Unfinished']['date'], '2026-10-21')
        self.assertEqual(by_text['Unfinished']['original_date'], '2026-10-18')
        # ticked items stay on the day they were done
        self.assertEqual(by_text['Finished']['date'], '2026-10-18')

    def test_future_items_are_not_moved(self):
        DailyNoteItem.objects.create(user=self.user, date=date(2026, 10, 25), original_date=date(2026, 10, 25), text='Later')
        resp = self.list_notes('2026-10-21', '2026-10-31', '2026-10-21')
        self.assertEqual(resp.data[0]['date'], '2026-10-25')

    def test_tick_item(self):
        item = DailyNoteItem.objects.create(user=self.user, date=date(2026, 10, 21), original_date=date(2026, 10, 21), text='Call mom')
        resp = self.client.patch(f'{self.url}{item.id}/', {'done': True}, format='json')
        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertTrue(item.done)

    def test_users_only_see_their_own_items(self):
        other = get_user_model().objects.create_user(username='other', password='pass')
        DailyNoteItem.objects.create(user=other, date=date(2026, 10, 21), original_date=date(2026, 10, 21), text='Secret')
        resp = self.list_notes('2026-10-21', '2026-10-21', '2026-10-21')
        self.assertEqual(resp.data, [])

    def test_list_requires_dates(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 400)

    def test_empty_text_rejected(self):
        resp = self.client.post(self.url, {'date': '2026-10-21', 'text': '   '}, format='json')
        self.assertEqual(resp.status_code, 400)
