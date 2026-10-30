from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from devices.models import Device

class Medicine(models.Model):
    TYPE_CHOICES = (
        ('TABLET', 'Tablet'),
        ('CAPSULE', 'Capsule'),
        ('SYRUP', 'Syrup'),
        ('INJECTION', 'Injection'),
        ('OTHER', 'Other'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medicines')
    name = models.CharField(max_length=100)
    generic_name = models.CharField(max_length=100, blank=True, null=True)
    dosage = models.CharField(max_length=50)
    medicine_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='TABLET')
    description = models.TextField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.dosage}) - {self.user.username}"

class MedicineCompartment(models.Model):
    STATUS_CHOICES = (
        ('AVAILABLE', 'Available'),
        ('LOW', 'Low'),
        ('EMPTY', 'Empty'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='compartments')
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name='compartments')
    compartment_number = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    assigned_medicine = models.ForeignKey(
        Medicine, on_delete=models.SET_NULL, null=True, blank=True, related_name='compartments'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'device', 'compartment_number')
        ordering = ['compartment_number']

    def clean(self):
        if self.compartment_number < 1 or self.compartment_number > 4:
            raise ValidationError("Compartment number must be between 1 and 4.")
        if self.assigned_medicine and self.assigned_medicine.user != self.user:
            raise ValidationError("Assigned medicine must belong to the same user.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        med_name = self.assigned_medicine.name if self.assigned_medicine else "Empty"
        return f"Compartment {self.compartment_number} ({med_name}) - {self.user.username}"
