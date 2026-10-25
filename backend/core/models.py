import uuid
from django.db import models
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

    Separate from Task: no priority, time or recurrence. Unchecked items
    from past days are rolled forward to today (see roll_over_unfinished).
    """
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'done', 'created_at']

    def __str__(self):
        return f"{self.date} {self.text} ({self.user})"

    @classmethod
    def roll_over_unfinished(cls, user, today):
        """Move every unchecked item dated before today onto today."""
        return cls.objects.filter(user=user, done=False, date__lt=today).update(date=today)
