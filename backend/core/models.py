import uuid
from datetime import timedelta
from django.db import models
from django.db.models import Count
from django.contrib.auth import get_user_model

User = get_user_model()


class Task(models.Model):
    PRIORITY_CHOICES = [
        ('CRITICAL', 'CRITICAL'),
        ('IMPORTANT', 'IMPORTANT'),
        ('ROUTINE', 'ROUTINE'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'PENDING'),
        ('COMPLETED', 'COMPLETED'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField()
    # optional end datetime or duration in minutes
    end_date = models.DateTimeField(blank=True, null=True)
    duration_minutes = models.IntegerField(blank=True, null=True)
    all_day = models.BooleanField(default=False)
    timezone = models.CharField(max_length=64, default='UTC')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    is_recurring = models.BooleanField(default=False)
    recurrence_rule = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.user})"


class RecurrenceException(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='exceptions')
    occurrence_date = models.DateTimeField()
    is_deleted = models.BooleanField(default=False)
    override_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('task', 'occurrence_date')


class DailyNoteItem(models.Model):
    """A quick checklist item (to-do or side quest) on a day's note.

    Separate from Task: no priority or time. Unchecked items from past days
    are rolled forward to today, and "daily" items get a fresh copy every day
    (see roll_over_unfinished).
    """
    # how many missed days a daily item is filled in for when the app wasn't opened
    MAX_DAILY_BACKFILL = 60

    KIND_CHOICES = [
        ('TODO', 'TODO'),
        ('SIDE_QUEST', 'SIDE_QUEST'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_items')
    date = models.DateField()
    # the day the item was first written on; differs from date once carried over
    original_date = models.DateField()
    text = models.CharField(max_length=255)
    kind = models.CharField(max_length=12, choices=KIND_CHOICES, default='TODO')
    done = models.BooleanField(default=False)
    # daily items come back unticked every day, one row per day
    repeat_daily = models.BooleanField(default=False)
    # every day's copy of a daily item shares the same series id
    series = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'done', 'created_at']
        constraints = [
            models.UniqueConstraint(fields=['series', 'date'], name='unique_note_series_per_day'),
        ]

    def __str__(self):
        return f"{self.date} {self.text} ({self.user})"

    def save(self, *args, **kwargs):
        if self.series is None:
            self.series = self.id
        super().save(*args, **kwargs)

    @classmethod
    def continue_daily_items(cls, user, today):
        """Give every daily item an unticked copy for each day up to today."""
        latest = {}
        for item in cls.objects.filter(user=user, repeat_daily=True, date__lte=today).order_by('date'):
            latest[item.series] = item
        earliest = today - timedelta(days=cls.MAX_DAILY_BACKFILL - 1)
        copies = []
        for item in latest.values():
            day = max(item.date + timedelta(days=1), earliest)
            while day <= today:
                copies.append(cls(user=user, date=day, original_date=item.original_date, text=item.text,
                                  kind=item.kind, repeat_daily=True, series=item.series))
                day += timedelta(days=1)
        # ignore_conflicts: two requests at once can't create the same day twice
        cls.objects.bulk_create(copies, ignore_conflicts=True)

    @classmethod
    def roll_over_unfinished(cls, user, today):
        """Create today's daily copies, then move other unchecked past items onto today.

        Days of a daily item (a series with more than one day) are never moved,
        even after Daily is switched off: a missed day stays as history.
        """
        cls.continue_daily_items(user, today)
        daily_series = (cls.objects.filter(user=user).values('series')
                        .annotate(days=Count('id')).filter(days__gt=1).values('series'))
        return (cls.objects.filter(user=user, done=False, repeat_daily=False, date__lt=today)
                .exclude(series__in=daily_series).update(date=today))
