from django.db import models
from django.contrib.auth.models import User

class Notification(models.Model):
    TYPE_CHOICES = (
        ('REMINDER', 'Reminder'),
        ('HARDWARE', 'Hardware'),
        ('ALERT', 'Alert'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    medicine_log = models.ForeignKey(
        'monitoring.MedicineLog', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications'
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='REMINDER')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.user.username} ({'Read' if self.is_read else 'Unread'})"
