from django.test import TestCase
from django.contrib.auth import get_user_model
from ..models import Task, RecurrenceException
from django.utils import timezone
from datetime import datetime, timedelta


class RecurrenceExpansionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='test', password='pass')

    def test_weekly_rrule_expansion(self):
        start = timezone.make_aware(datetime(2026, 6, 1))
        task = Task.objects.create(
            user=self.user,
            title='Weekly Task',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;COUNT=3'
        )

        from ..utils import expand_recurring_tasks

        end = start + timedelta(days=21)
        occurrences = expand_recurring_tasks([task], RecurrenceException.objects.none(), start, end)
        self.assertEqual(len(occurrences), 3)

    def test_exception_deletes_occurrence(self):
        start = timezone.make_aware(datetime(2026, 6, 1))
        task = Task.objects.create(
            user=self.user,
            title='Weekly Task',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;COUNT=3'
        )
        # delete second occurrence
        second_occ = start + timedelta(weeks=1)
        RecurrenceException.objects.create(task=task, occurrence_date=second_occ, is_deleted=True)

        from ..utils import expand_recurring_tasks

        end = start + timedelta(days=21)
        occurrences = expand_recurring_tasks([task], RecurrenceException.objects.filter(task=task), start, end)
        self.assertEqual(len(occurrences), 2)

    def test_weekday_rule_uses_viewer_timezone(self):
        # Monday 26 Oct 00:00 in India is Sunday 25 Oct 18:30 in UTC
        from zoneinfo import ZoneInfo
        from ..utils import expand_recurring_tasks
        india = ZoneInfo('Asia/Kolkata')
        start = datetime(2026, 10, 26, tzinfo=india)
        task = Task.objects.create(
            user=self.user,
            title='Gym',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO,FR;COUNT=4'
        )
        occurrences = expand_recurring_tasks([task], RecurrenceException.objects.none(), start, start + timedelta(days=14), tz=india)
        local_days = [datetime.fromisoformat(o['date']).astimezone(india).strftime('%a %d') for o in occurrences]
        self.assertEqual(local_days, ['Mon 26', 'Fri 30', 'Mon 02', 'Fri 06'])
