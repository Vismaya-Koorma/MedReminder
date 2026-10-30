from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.utils import timezone
from datetime import timedelta
from medicines.models import Medicine
from monitoring.models import MedicineLog
from monitoring.services import generate_today_logs_for_user
from monitoring.serializers import MedicineLogSerializer
from devices.models import Device
from devices.serializers import DeviceSerializer
from notifications.models import Notification
from accounts.utils import get_target_patient_user

def calculate_weekly_adherence(user):
    """
    Calculates Monday through Sunday adherence for the current week.
    Daily adherence percentage = (Doses Taken / Total Scheduled Doses) * 100
    - Doses with TAKEN status count as completed.
    - All scheduled doses for the corresponding day count in the denominator (including missed).
    - Upcoming or unscheduled doses do not count as taken.
    - If no doses were scheduled on a particular day, adherence is None (displayed as "—").
    """
    generate_today_logs_for_user(user)
    today = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()
    start_of_week = today - timedelta(days=today.weekday())  # Monday
    end_of_week = start_of_week + timedelta(days=6)          # Sunday

    days_data = []
    total_week_taken = 0
    total_week_scheduled = 0

    for i in range(7):
        day_date = start_of_week + timedelta(days=i)
        day_logs = MedicineLog.objects.filter(
            user=user,
            scheduled_time__date=day_date
        ).exclude(status='SKIPPED')

        taken_count = day_logs.filter(status='TAKEN').count()
        scheduled_count = day_logs.count()
        missed_count = day_logs.filter(status='MISSED').count()
        upcoming_count = day_logs.filter(status__in=['UPCOMING', 'DUE']).count()

        if scheduled_count > 0:
            pct = round((taken_count / scheduled_count) * 100, 1)
            total_week_taken += taken_count
            total_week_scheduled += scheduled_count
        else:
            pct = None

        days_data.append({
            "day": day_date.strftime('%a'),
            "day_name": day_date.strftime('%A'),
            "date": day_date.strftime('%Y-%m-%d'),
            "taken_count": taken_count,
            "scheduled_count": scheduled_count,
            "missed_count": missed_count,
            "upcoming_count": upcoming_count,
            "adherence_percentage": pct,
            "is_today": (day_date == today)
        })

    weekly_avg = round((total_week_taken / total_week_scheduled) * 100, 1) if total_week_scheduled > 0 else None

    return {
        "start_date": start_of_week.strftime('%Y-%m-%d'),
        "end_date": end_of_week.strftime('%Y-%m-%d'),
        "week_label": f"{start_of_week.strftime('%b %d')} - {end_of_week.strftime('%b %d, %Y')}",
        "total_week_taken": total_week_taken,
        "total_week_scheduled": total_week_scheduled,
        "weekly_adherence_percentage": weekly_avg,
        "days": days_data
    }

class WeeklyAdherenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = get_target_patient_user(request.user)
        data = calculate_weekly_adherence(user)
        return Response({
            "success": True,
            "message": "Weekly medication adherence retrieved successfully",
            "data": data
        }, status=status.HTTP_200_OK)

class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = get_target_patient_user(request.user)
        generate_today_logs_for_user(user)
        today = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()

        total_medicines = Medicine.objects.filter(user=user, is_active=True).count()
        today_logs = MedicineLog.objects.filter(
            user=user,
            scheduled_time__date=today,
            schedule__isnull=False,
            schedule__is_active=True
        ).order_by('scheduled_time')

        taken_count = today_logs.filter(status='TAKEN').count()
        pending_count = today_logs.filter(status__in=['UPCOMING', 'DUE']).count()
        missed_count = today_logs.filter(status='MISSED').count()
        today_doses_count = today_logs.count()

        # Overall adherence calculation
        all_logs = MedicineLog.objects.filter(user=user)
        evaluated = all_logs.filter(status__in=['TAKEN', 'MISSED']).count()
        all_taken = all_logs.filter(status='TAKEN').count()
        adherence_percentage = round((all_taken / evaluated * 100), 2) if evaluated > 0 else 100.0

        # Weekly adherence calculation
        weekly_adherence = calculate_weekly_adherence(user)

        # Device status
        device = Device.objects.filter(user=user).first()
        device_data = DeviceSerializer(device).data if device else None

        # Unread notifications
        unread_notifications = Notification.objects.filter(user=user, is_read=False).count()

        return Response({
            "success": True,
            "message": "Dashboard summary retrieved successfully",
            "data": {
                "total_medicines": total_medicines,
                "today_doses_count": today_doses_count,
                "taken_count": taken_count,
                "pending_count": pending_count,
                "missed_count": missed_count,
                "adherence_percentage": adherence_percentage,
                "unread_notifications": unread_notifications,
                "today_medicines": MedicineLogSerializer(today_logs, many=True).data,
                "weekly_adherence": weekly_adherence,
                "device": device_data
            }
        }, status=status.HTTP_200_OK)
