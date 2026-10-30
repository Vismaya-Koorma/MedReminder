from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.utils import timezone
from .models import MedicineLog
from .serializers import MedicineLogSerializer
from .services import generate_today_logs_for_user
from accounts.utils import get_target_patient_user

class TodayMonitoringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = get_target_patient_user(request.user)
        generate_today_logs_for_user(user)
        today = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()
        logs = MedicineLog.objects.filter(
            user=user,
            scheduled_time__date=today,
            schedule__isnull=False,
            schedule__is_active=True
        ).order_by('scheduled_time')
        serializer = MedicineLogSerializer(logs, many=True)
        return Response({
            "success": True,
            "message": "Today's medicine logs retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

class HistoryMonitoringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = get_target_patient_user(request.user)
        queryset = MedicineLog.objects.filter(user=user)

        # Filters
        date_param = request.query_params.get('date')
        medicine_id = request.query_params.get('medicine_id')
        status_param = request.query_params.get('status')
        compartment = request.query_params.get('compartment')

        if date_param:
            queryset = queryset.filter(scheduled_time__date=date_param)
        if medicine_id:
            queryset = queryset.filter(medicine_id=medicine_id)
        if status_param:
            queryset = queryset.filter(status=status_param.upper())
        if compartment:
            queryset = queryset.filter(compartment_number=compartment)

        queryset = queryset.order_by('-scheduled_time')
        serializer = MedicineLogSerializer(queryset, many=True)
        return Response({
            "success": True,
            "message": "Medicine history retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

class AdherenceMonitoringView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = get_target_patient_user(request.user)
        generate_today_logs_for_user(user)
        logs = MedicineLog.objects.filter(user=user)
        
        total_doses = logs.count()
        taken_count = logs.filter(status='TAKEN').count()
        missed_count = logs.filter(status='MISSED').count()
        pending_count = logs.filter(status__in=['UPCOMING', 'DUE']).count()
        skipped_count = logs.filter(status='SKIPPED').count()

        evaluated_doses = taken_count + missed_count
        adherence_percentage = round((taken_count / evaluated_doses * 100), 2) if evaluated_doses > 0 else 100.0

        return Response({
            "success": True,
            "message": "Adherence statistics calculated successfully",
            "data": {
                "total_doses": total_doses,
                "taken_count": taken_count,
                "missed_count": missed_count,
                "pending_count": pending_count,
                "skipped_count": skipped_count,
                "adherence_percentage": adherence_percentage
            }
        }, status=status.HTTP_200_OK)
