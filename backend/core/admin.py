from django.contrib import admin
from .models import Task, RecurrenceException, DailyNoteItem

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'date', 'priority', 'status', 'is_recurring')

@admin.register(RecurrenceException)
class RecurrenceExceptionAdmin(admin.ModelAdmin):
    list_display = ('task', 'occurrence_date', 'is_deleted')

@admin.register(DailyNoteItem)
class DailyNoteItemAdmin(admin.ModelAdmin):
    list_display = ('text', 'user', 'date', 'original_date', 'kind', 'done')
