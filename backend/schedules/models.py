from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from medicines.models import Medicine, MedicineCompartment

class MedicineSchedule(models.Model):
    FREQUENCY_CHOICES = (
        ('ONCE', 'Once'),
        ('DAILY', 'Daily'),
        ('TWICE_DAILY', 'Twice Daily'),
        ('THREE_TIMES_DAILY', 'Three Times Daily'),
        ('CUSTOM', 'Custom'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='schedules')
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='schedules')
    compartment = models.ForeignKey(
        MedicineCompartment, on_delete=models.SET_NULL, null=True, blank=True, related_name='schedules'
    )
    schedule_time = models.TimeField()
    frequency = models.CharField(max_length=30, choices=FREQUENCY_CHOICES, default='DAILY')
    dosage = models.CharField(max_length=50)
    instructions = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.medicine and self.medicine.user != self.user:
            raise ValidationError("Medicine must belong to the logged-in user.")
        if self.compartment and self.compartment.user != self.user:
            raise ValidationError("Compartment must belong to the logged-in user.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.medicine.name} at {self.schedule_time.strftime('%H:%M')} ({self.frequency}) - {self.user.username}"
