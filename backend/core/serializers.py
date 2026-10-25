from rest_framework import serializers
from .models import Task, RecurrenceException, DailyNoteItem
from django.contrib.auth import get_user_model
from datetime import timedelta

User = get_user_model()


class TaskSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    # accept legacy 'DONE' value from older clients and normalize to 'COMPLETED'
    status = serializers.CharField(required=False, allow_null=True)

    class Meta:
        model = Task
        fields = (
            'id', 'user', 'title', 'description', 'date', 'end_date', 'duration_minutes', 'all_day', 'timezone', 'priority', 'status', 'is_recurring', 'recurrence_rule', 'created_at', 'updated_at'
        )
        extra_kwargs = {'user': {'read_only': True}}

    def create(self, validated_data):
        # compute end_date from duration if provided
        duration = validated_data.get('duration_minutes')
        if duration and 'end_date' not in validated_data:
            start = validated_data.get('date')
            if start:
                validated_data['end_date'] = start + timedelta(minutes=duration)
        return Task.objects.create(**validated_data)

    def update(self, instance, validated_data):
        duration = validated_data.get('duration_minutes')
        if duration and 'end_date' not in validated_data:
            start = validated_data.get('date', instance.date)
            if start:
                validated_data['end_date'] = start + timedelta(minutes=duration)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    def validate_status(self, value):
        if value is None:
            return value
        # normalize legacy value
        if value == 'DONE':
            return 'COMPLETED'
        valid = [c[0] for c in Task._meta.get_field('status').choices]
        if value not in valid:
            raise serializers.ValidationError('Invalid status')
        return value


class RecurrenceExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurrenceException
        fields = ('id', 'task', 'occurrence_date', 'is_deleted', 'override_data', 'created_at')

    def validate_override_data(self, value):
        # normalize legacy status values in override payloads
        if not value:
            return value
        if isinstance(value, dict):
            if value.get('status') == 'DONE':
                value['status'] = 'COMPLETED'
        return value


class DailyNoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyNoteItem
        fields = ('id', 'date', 'original_date', 'text', 'kind', 'done', 'repeat_daily', 'created_at')
        read_only_fields = ('original_date', 'created_at')

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Text cannot be empty')
        return value

    def create(self, validated_data):
        validated_data['original_date'] = validated_data['date']
        return super().create(validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists')
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
