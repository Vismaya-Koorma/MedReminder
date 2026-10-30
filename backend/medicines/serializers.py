from rest_framework import serializers
from .models import Medicine, MedicineCompartment

class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = '__all__'
        read_only_fields = ('user', 'created_at')

class MedicineCompartmentSerializer(serializers.ModelSerializer):
    assigned_medicine_detail = MedicineSerializer(source='assigned_medicine', read_only=True)

    class Meta:
        model = MedicineCompartment
        fields = '__all__'
        read_only_fields = ('user', 'created_at')

    def validate_compartment_number(self, value):
        if value < 1 or value > 4:
            raise serializers.ValidationError("Compartment number must be between 1 and 4.")
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None
        assigned_medicine = attrs.get('assigned_medicine')
        if assigned_medicine and user and assigned_medicine.user != user:
            raise serializers.ValidationError({"assigned_medicine": "Assigned medicine must belong to you."})
        return attrs
