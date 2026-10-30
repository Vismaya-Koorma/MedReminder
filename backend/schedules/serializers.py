from rest_framework import serializers
from .models import MedicineSchedule
from medicines.serializers import MedicineSerializer, MedicineCompartmentSerializer
from medicines.models import Medicine, MedicineCompartment

class MedicineScheduleSerializer(serializers.ModelSerializer):
    medicine_detail = MedicineSerializer(source='medicine', read_only=True)
    compartment_detail = MedicineCompartmentSerializer(source='compartment', read_only=True)

    class Meta:
        model = MedicineSchedule
        fields = '__all__'
        read_only_fields = ('user', 'created_at')

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None

        medicine = attrs.get('medicine') or (self.instance.medicine if self.instance else None)
        compartment = attrs.get('compartment') or (self.instance.compartment if self.instance else None)

        if user:
            if medicine and medicine.user != user:
                raise serializers.ValidationError({"medicine": "Selected medicine must belong to you."})
            if compartment and compartment.user != user:
                raise serializers.ValidationError({"compartment": "Selected compartment must belong to you."})
        return attrs
