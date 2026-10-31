from django.contrib import admin

from .models import Medicine, MedicineCompartment



@admin.register(Medicine)

class MedicineAdmin(admin.ModelAdmin):

    list_display = ('name', 'user', 'dosage', 'medicine_type', 'is_active', 'created_at')

    list_filter = ('medicine_type', 'is_active', 'created_at')

    search_fields = ('name', 'user__username')



@admin.register(MedicineCompartment)

class MedicineCompartmentAdmin(admin.ModelAdmin):

    list_display = ('compartment_number', 'user', 'assigned_medicine', 'status', 'created_at')

    list_filter = ('status', 'compartment_number')

    search_fields = ('user__username', 'assigned_medicine__name')

