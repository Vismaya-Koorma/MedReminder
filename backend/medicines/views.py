from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Medicine, MedicineCompartment
from .serializers import MedicineSerializer, MedicineCompartmentSerializer
from accounts.utils import get_target_patient_user

class MedicineViewSet(viewsets.ModelViewSet):
    serializer_class = MedicineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = get_target_patient_user(self.request.user)
        queryset = Medicine.objects.filter(user=user)
        include_inactive = self.request.query_params.get('include_inactive', 'false')
        if include_inactive.lower() != 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

    def perform_create(self, serializer):
        user = get_target_patient_user(self.request.user)
        serializer.save(user=user)

    def perform_destroy(self, instance):
        # Soft deletion as requested
        instance.is_active = False
        instance.save()

class CompartmentViewSet(viewsets.ModelViewSet):
    serializer_class = MedicineCompartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = get_target_patient_user(self.request.user)
        # Ensure compartments 1 to 4 exist for the target patient
        existing_numbers = set(
            MedicineCompartment.objects.filter(user=user, device__isnull=True).values_list('compartment_number', flat=True)
        )
        for num in range(1, 5):
            if num not in existing_numbers:
                MedicineCompartment.objects.create(user=user, compartment_number=num, status='EMPTY')
        return MedicineCompartment.objects.filter(user=user).order_by('compartment_number')

    def perform_create(self, serializer):
        user = get_target_patient_user(self.request.user)
        serializer.save(user=user)
