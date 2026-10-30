from rest_framework import viewsets, permissions
from .models import MedicineSchedule
from .serializers import MedicineScheduleSerializer
from monitoring.services import generate_today_logs_for_user
from accounts.utils import get_target_patient_user

class MedicineScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = MedicineScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = get_target_patient_user(self.request.user)
        return MedicineSchedule.objects.filter(user=user)

    def perform_create(self, serializer):
        user = get_target_patient_user(self.request.user)
        schedule = serializer.save(user=user)
        generate_today_logs_for_user(user)

    def perform_update(self, serializer):
        schedule = serializer.save()
        generate_today_logs_for_user(schedule.user)
