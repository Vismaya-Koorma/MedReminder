from django.db import models
from django.contrib.auth.models import User
from medicines.models import Medicine
from schedules.models import MedicineSchedule
from devices.models import DeviceEvent

class MedicineLog(models.Model):
    STATUS_CHOICES = (
        ('UPCOMING', 'Upcoming'),
        ('DUE', 'Due'),
        ('TAKEN', 'Taken'),
        ('MISSED', 'Missed'),
        ('SKIPPED', 'Skipped'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medicine_logs')
    schedule = models.ForeignKey(
        MedicineSchedule, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs'
    )
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='logs')
    scheduled_time = models.DateTimeField()
    taken_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPCOMING')
    compartment_number = models.IntegerField(default=1)
    device_event = models.ForeignKey(
        DeviceEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'schedule', 'scheduled_time')
        ordering = ['scheduled_time']

    def __str__(self):
        return f"{self.medicine.name} at {self.scheduled_time.strftime('%Y-%m-%d %H:%M')} - {self.status}"
