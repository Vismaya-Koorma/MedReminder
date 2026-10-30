from rest_framework import serializers
from .models import MedicineLog
from medicines.serializers import MedicineSerializer
from schedules.serializers import MedicineScheduleSerializer

class MedicineLogSerializer(serializers.ModelSerializer):
    medicine_detail = MedicineSerializer(source='medicine', read_only=True)
    schedule_detail = MedicineScheduleSerializer(source='schedule', read_only=True)
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    dosage = serializers.CharField(source='medicine.dosage', read_only=True)

    class Meta:
        model = MedicineLog
        fields = '__all__'
        read_only_fields = ('user', 'created_at')
