from django.contrib import admin
from .models import Device, DeviceEvent

@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('device_id', 'device_name', 'user', 'status', 'battery_level', 'wifi_status', 'is_simulated', 'last_seen')
    list_filter = ('status', 'is_simulated', 'created_at')
    search_fields = ('device_id', 'device_name', 'user__username')

@admin.register(DeviceEvent)
class DeviceEventAdmin(admin.ModelAdmin):
    list_display = ('device', 'compartment_number', 'event_type', 'timestamp')
    list_filter = ('event_type', 'compartment_number', 'timestamp')
    search_fields = ('device__device_id', 'event_type')
