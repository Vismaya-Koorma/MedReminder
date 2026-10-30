from django.db import models
from django.contrib.auth.models import User

class Device(models.Model):
    STATUS_CHOICES = (
        ('ONLINE', 'Online'),
        ('OFFLINE', 'Offline'),
    )

    device_id = models.CharField(max_length=50, unique=True)
    device_name = models.CharField(max_length=100, default='Medicine Dispenser')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ONLINE')
    last_seen = models.DateTimeField(auto_now=True)
    firmware_version = models.CharField(max_length=20, default='1.0.0')
    battery_level = models.IntegerField(default=100)
    wifi_status = models.CharField(max_length=50, default='Connected')
    is_simulated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.device_id} - {self.device_name} ({self.user.username})"

class DeviceEvent(models.Model):
    EVENT_TYPES = (
        ('COMPARTMENT_OPENED', 'Compartment Opened'),
        ('COMPARTMENT_CLOSED', 'Compartment Closed'),
        ('REMINDER_ACKNOWLEDGED', 'Reminder Acknowledged'),
        ('MEDICINE_TAKEN', 'Medicine Taken'),
        ('MEDICINE_NOT_TAKEN', 'Medicine Not Taken'),
        ('DEVICE_ONLINE', 'Device Online'),
        ('DEVICE_OFFLINE', 'Device Offline'),
    )

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='events')
    compartment_number = models.IntegerField(blank=True, null=True)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    raw_payload = models.JSONField(blank=True, default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Event {self.event_type} on Device {self.device.device_id} at {self.timestamp}"
