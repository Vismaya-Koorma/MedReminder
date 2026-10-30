from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.utils import timezone
from django.db import models
from .models import Device, DeviceEvent
from .serializers import (
    DeviceSerializer, DeviceEventSerializer, DeviceRegisterSerializer,
    DeviceHeartbeatSerializer, MedicineEventSerializer, CompartmentEventSerializer
)
from medicines.models import MedicineCompartment
from monitoring.models import MedicineLog
from monitoring.services import generate_today_logs_for_user
from notifications.models import Notification
from accounts.utils import get_target_patient_user

class DeviceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        devices = Device.objects.filter(user=request.user)
        # Ensure default device exists for user if none registered yet
        if not devices.exists():
            dev_id = f"MED-{request.user.id:03d}" if request.user.id else f"MED-001-{request.user.username}"
            default_device, _ = Device.objects.get_or_create(
                device_id=dev_id,
                defaults={
                    'device_name': "Medicine Dispenser",
                    'user': request.user,
                    'status': "ONLINE",
                    'battery_level': 95,
                    'wifi_status': "Connected"
                }
            )
            devices = Device.objects.filter(user=request.user)

        serializer = DeviceSerializer(devices, many=True)
        return Response({
            "success": True,
            "message": "Devices retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

class DeviceRegisterView(APIView):
    # Device APIs can be authenticated by Token or Session or user session
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DeviceRegisterSerializer(data=request.data)
        if serializer.is_valid():
            device_id = serializer.validated_data['device_id']
            device_name = serializer.validated_data['device_name']

            device, created = Device.objects.get_or_create(
                device_id=device_id,
                defaults={
                    'device_name': device_name,
                    'user': request.user,
                    'status': 'ONLINE'
                }
            )
            if not created:
                device.device_name = device_name
                device.user = request.user
                device.status = 'ONLINE'
                device.save()

            return Response({
                "success": True,
                "message": "Device registered successfully",
                "data": DeviceSerializer(device).data
            }, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)

        return Response({
            "success": False,
            "message": "Invalid device registration data",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class DeviceHeartbeatView(APIView):
    permission_classes = [permissions.AllowAny]  # ESP32 device can send heartbeat

    def post(self, request):
        serializer = DeviceHeartbeatSerializer(data=request.data)
        if serializer.is_valid():
            device_id = serializer.validated_data['device_id']
            try:
                device = Device.objects.get(device_id=device_id)
                device.battery_level = serializer.validated_data['battery_level']
                device.wifi_status = serializer.validated_data['wifi_status']
                device.firmware_version = serializer.validated_data['firmware_version']
                if serializer.validated_data.get('is_simulated') is not None:
                    device.is_simulated = serializer.validated_data['is_simulated']
                device.status = 'ONLINE'
                device.save()
                generate_today_logs_for_user(device.user)
                is_due = MedicineLog.objects.filter(user=device.user, status='DUE').exists()
                return Response({
                    "success": True,
                    "message": "Heartbeat received",
                    "data": DeviceSerializer(device).data,
                    "is_reminder_due": is_due
                }, status=status.HTTP_200_OK)
            except Device.DoesNotExist:
                return Response({
                    "success": False,
                    "message": f"Device {device_id} not registered"
                }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "success": False,
            "message": "Invalid heartbeat data",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class DeviceStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        target_user = get_target_patient_user(request.user)
        device_id = request.query_params.get('device_id')
        device = None

        if device_id:
            device = Device.objects.filter(device_id=device_id).first()

        if not device:
            # First look for devices belonging to user or monitored patient, prioritized by physical hardware or last seen
            user_devices = Device.objects.filter(
                models.Q(user=request.user) | models.Q(user=target_user)
            ).order_by('is_simulated', '-last_seen')
            device = user_devices.first()

        # If user's only device has no events and is simulated, check if there is an active device with events (like MED-001)
        if not device or (device.is_simulated and not device.events.exists()):
            active_device = Device.objects.filter(events__isnull=False).order_by('-last_seen').first()
            if active_device:
                device = active_device

        if not device:
            dev_id = f"MED-{target_user.id:03d}" if target_user.id else f"MED-001-{target_user.username}"
            device, _ = Device.objects.get_or_create(
                device_id=dev_id,
                defaults={
                    'device_name': "Medicine Dispenser",
                    'user': target_user,
                    'status': "ONLINE"
                }
            )

        # Mark device as physical hardware if it has recorded compartment events
        if device.events.filter(event_type__in=['COMPARTMENT_OPENED', 'COMPARTMENT_CLOSED']).exists() and device.is_simulated:
            device.is_simulated = False
            device.save(update_fields=['is_simulated'])

        # Ensure compartments 1 to 4 exist
        existing_numbers = set(
            MedicineCompartment.objects.filter(user=target_user, device__isnull=True).values_list('compartment_number', flat=True)
        )
        for num in range(1, 5):
            if num not in existing_numbers:
                MedicineCompartment.objects.create(user=target_user, compartment_number=num, status='EMPTY')

        compartments = MedicineCompartment.objects.filter(user=target_user).order_by('compartment_number')
        events = DeviceEvent.objects.filter(device=device).order_by('-timestamp')[:10]

        available_devices = Device.objects.filter(
            models.Q(user=request.user) | models.Q(user=target_user) | models.Q(id=device.id) | models.Q(events__isnull=False)
        ).distinct().order_by('is_simulated', '-last_seen')

        generate_today_logs_for_user(target_user)
        is_reminder_due = MedicineLog.objects.filter(user=target_user, status='DUE').exists()

        return Response({
            "success": True,
            "message": "Device status retrieved successfully",
            "data": {
                "device": DeviceSerializer(device).data,
                "available_devices": DeviceSerializer(available_devices, many=True).data,
                "is_reminder_due": is_reminder_due,
                "compartments": [
                    {
                        "compartment_number": c.compartment_number,
                        "status": c.status,
                        "assigned_medicine": c.assigned_medicine.name if c.assigned_medicine else None
                    } for c in compartments
                ],
                "recent_events": DeviceEventSerializer(events, many=True).data
            }
        }, status=status.HTTP_200_OK)

class DeviceReminderDueView(APIView):
    """
    Lightweight endpoint for ESP32 and clients to check if any medicine reminder is currently DUE.
    Runs reminder engine to evaluate scheduled doses against current time.
    Supports optional compartment filtering (?compartment=1).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        generate_today_logs_for_user(request.user)
        compartment = request.query_params.get('compartment')

        due_logs = MedicineLog.objects.filter(
            user=request.user,
            status='DUE'
        )
        if compartment:
            due_logs = due_logs.filter(compartment_number=compartment)

        is_due = due_logs.exists()
        active_log = due_logs.first()

        return Response({
            "success": True,
            "is_reminder_due": is_due,
            "due_count": due_logs.count(),
            "compartment": int(compartment) if (compartment and compartment.isdigit()) else (active_log.compartment_number if active_log else None),
            "medicine_name": active_log.medicine.name if active_log else None
        }, status=status.HTTP_200_OK)

class DeviceMedicineEventView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = MedicineEventSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid medicine event payload",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        device_id = serializer.validated_data['device_id']
        compartment_num = serializer.validated_data['compartment']
        event_str = serializer.validated_data['event'].upper()
        target_user = get_target_patient_user(request.user)

        # Validate Device (allows user or caregiver monitoring the target patient)
        device = Device.objects.filter(device_id=device_id).filter(
            models.Q(user=request.user) | models.Q(user=target_user)
        ).first()

        if not device:
            return Response({
                "success": False,
                "message": f"Device {device_id} not found or does not belong to user."
            }, status=status.HTTP_404_NOT_FOUND)

        # Record raw DeviceEvent
        device_event = DeviceEvent.objects.create(
            device=device,
            compartment_number=compartment_num,
            event_type='MEDICINE_TAKEN' if 'TAKEN' in event_str else 'MEDICINE_NOT_TAKEN',
            raw_payload=request.data
        )

        # Generate latest today logs
        generate_today_logs_for_user(device.user)
        today = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()

        log_id = serializer.validated_data.get('log_id')
        mark_all_due = serializer.validated_data.get('mark_all_due', False)

        target_logs = []
        if log_id:
            specific_log = MedicineLog.objects.filter(id=log_id, user=device.user).first()
            if specific_log:
                target_logs = [specific_log]

        if not target_logs:
            pending_qs = MedicineLog.objects.filter(
                user=device.user,
                compartment_number=compartment_num,
                scheduled_time__date=today,
                status__in=['DUE', 'UPCOMING']
            ).order_by(
                # Prioritize DUE over UPCOMING, then chronological
                models.Case(
                    models.When(status='DUE', then=models.Value(0)),
                    default=models.Value(1),
                    output_field=models.IntegerField()
                ),
                'scheduled_time'
            )

            if mark_all_due:
                due_only = list(pending_qs.filter(status='DUE'))
                target_logs = due_only if due_only else ([pending_qs.first()] if pending_qs.exists() else [])
            else:
                first_log = pending_qs.first()
                if first_log:
                    target_logs = [first_log]

        if target_logs:
            now_time = timezone.now()
            status_value = 'TAKEN' if 'TAKEN' in event_str else 'MISSED'

            for pending_log in target_logs:
                pending_log.status = status_value
                pending_log.taken_time = now_time
                pending_log.device_event = device_event
                pending_log.save()

                # Create Notification linked to medicine_log
                Notification.objects.create(
                    user=request.user,
                    medicine_log=pending_log,
                    title="Medicine Taken Successfully" if pending_log.status == 'TAKEN' else "Medicine Event Recorded",
                    message=f"{pending_log.medicine.name} ({pending_log.medicine.dosage}) from Compartment {compartment_num} was marked as {pending_log.status}.",
                    type="REMINDER"
                )

            primary_log = target_logs[0]
            return Response({
                "success": True,
                "message": f"{len(target_logs)} medicine log(s) updated to {primary_log.status}",
                "data": {
                    "log_id": primary_log.id,
                    "medicine": primary_log.medicine.name,
                    "status": primary_log.status,
                    "compartment": compartment_num,
                    "taken_time": primary_log.taken_time
                }
            }, status=status.HTTP_200_OK)
        else:
            # Fallback when no dose is strictly DUE: create a notification and return confirmation
            Notification.objects.create(
                user=request.user,
                title="Hardware Event Recorded",
                message=f"Device event '{event_str}' received for Compartment {compartment_num}.",
                type="HARDWARE"
            )
            return Response({
                "success": True,
                "message": f"Device event recorded successfully for Compartment {compartment_num}.",
                "data": {
                    "device_event_id": device_event.id,
                    "compartment": compartment_num
                }
            }, status=status.HTTP_200_OK)

class DeviceCompartmentEventView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CompartmentEventSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Invalid compartment event payload",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        device_id = serializer.validated_data['device_id']
        compartment_num = serializer.validated_data['compartment']
        event_str = serializer.validated_data['event'].upper()

        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return Response({
                "success": False,
                "message": f"Device {device_id} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        # Mark physical hardware when physical compartment event is received
        if device.is_simulated:
            device.is_simulated = False
            device.save(update_fields=['is_simulated'])

        device_event = DeviceEvent.objects.create(
            device=device,
            compartment_number=compartment_num,
            event_type=event_str if event_str in dict(DeviceEvent.EVENT_TYPES) else 'COMPARTMENT_OPENED',
            raw_payload=request.data
        )

        # When hand is detected at compartment (REMINDER_ACKNOWLEDGED or COMPARTMENT_OPENED),
        # automatically mark any active DUE medicine dose for this compartment as TAKEN!
        medicine_marked = False
        if event_str in ['REMINDER_ACKNOWLEDGED', 'COMPARTMENT_OPENED']:
            generate_today_logs_for_user(device.user)
            today = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()
            due_logs = MedicineLog.objects.filter(
                user=device.user,
                compartment_number=compartment_num,
                scheduled_time__date=today,
                status='DUE'
            ).order_by('scheduled_time')

            if due_logs.exists():
                now_time = timezone.now()
                for d_log in due_logs:
                    d_log.status = 'TAKEN'
                    d_log.taken_time = now_time
                    d_log.device_event = device_event
                    d_log.save()
                    Notification.objects.create(
                        user=device.user,
                        medicine_log=d_log,
                        title="Medicine Taken Successfully",
                        message=f"{d_log.medicine.name} ({d_log.medicine.dosage}) from Compartment {compartment_num} was automatically confirmed as TAKEN via dispenser sensor.",
                        type="REMINDER"
                    )
                medicine_marked = True

        # Create notification for device owner and request user
        notif_msg = (
            f"Hand detected at compartment {compartment_num}. Dose confirmed TAKEN and reminder LED turned OFF."
            if (event_str == 'REMINDER_ACKNOWLEDGED' and medicine_marked)
            else (
                f"Hand detected at compartment {compartment_num}. Reminder LED dismissed; pending medicine confirmation."
                if event_str == 'REMINDER_ACKNOWLEDGED'
                else f"Dispenser compartment {compartment_num} trigger event recorded."
            )
        )
        Notification.objects.create(
            user=device.user,
            title=f"Compartment {compartment_num} {event_str.replace('_', ' ').title()}",
            message=notif_msg,
            type="HARDWARE"
        )
        if request.user != device.user:
            Notification.objects.create(
                user=request.user,
                title=f"Compartment {compartment_num} {event_str.replace('_', ' ').title()}",
                message=f"{notif_msg} (on device {device_id})",
                type="HARDWARE"
            )

        return Response({
            "success": True,
            "message": f"Compartment {compartment_num} event recorded",
            "data": {
                "event_id": device_event.id,
                "event_type": device_event.event_type
            }
        }, status=status.HTTP_200_OK)
