from django.contrib import admin
from .models import MedicineLog

@admin.register(MedicineLog)
class MedicineLogAdmin(admin.ModelAdmin):
    list_display = ('medicine', 'user', 'compartment_number', 'scheduled_time', 'status', 'taken_time')
    list_filter = ('status', 'scheduled_time')
    search_fields = ('medicine__name', 'user__username')
