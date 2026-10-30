from rest_framework import serializers
from .models import Device, DeviceEvent

class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = '__all__'
        read_only_fields = ('user', 'last_seen', 'created_at')

class DeviceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceEvent
        fields = '__all__'
        read_only_fields = ('timestamp',)

class DeviceRegisterSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=50)
    device_name = serializers.CharField(max_length=100, default='Medicine Dispenser')
    is_simulated = serializers.BooleanField(required=False, default=True)

class DeviceHeartbeatSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=50)
    battery_level = serializers.IntegerField(default=100)
    wifi_status = serializers.CharField(default='Connected')
    firmware_version = serializers.CharField(default='1.0.0')
    is_simulated = serializers.BooleanField(required=False, allow_null=True, default=None)

class MedicineEventSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=50)
    compartment = serializers.IntegerField(min_value=1, max_value=4)
    event = serializers.CharField(max_length=50)  # e.g., 'medicine_taken' or 'MEDICINE_TAKEN'
    timestamp = serializers.DateTimeField(required=False)
    log_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    mark_all_due = serializers.BooleanField(required=False, default=False)

class CompartmentEventSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=50)
    compartment = serializers.IntegerField(min_value=1, max_value=4)
    event = serializers.CharField(max_length=50)  # e.g., 'COMPARTMENT_OPENED'
    timestamp = serializers.DateTimeField(required=False)
