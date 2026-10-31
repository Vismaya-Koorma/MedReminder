from django.contrib import admin
from .models import MedicineSchedule

@admin.register(MedicineSchedule)
class MedicineScheduleAdmin(admin.ModelAdmin):
    list_display = ('medicine', 'user', 'compartment', 'schedule_time', 'frequency', 'is_active')
    list_filter = ('frequency', 'is_active')
    search_fields = ('medicine__name', 'user__username')
