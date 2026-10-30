import logging
from datetime import datetime, timedelta, time
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from django.contrib.auth.models import User
from schedules.models import MedicineSchedule
from notifications.models import Notification
from .models import MedicineLog

logger = logging.getLogger(__name__)

def get_schedule_occurrences(schedule, target_date):
    """
    Returns timezone-aware datetimes for a schedule on a given date based on frequency.
    """
    # Combine date with base schedule_time
    base_naive = datetime.combine(target_date, schedule.schedule_time)
    base_dt = timezone.make_aware(base_naive) if timezone.is_naive(base_naive) else base_naive

    occurrences = [base_dt]

    if schedule.frequency == 'TWICE_DAILY':
        occurrences.append(base_dt + timedelta(hours=12))
    elif schedule.frequency == 'THREE_TIMES_DAILY':
        occurrences.append(base_dt + timedelta(hours=6))
        occurrences.append(base_dt + timedelta(hours=12))

    return occurrences

def process_automatic_reminders(user=None):
    """
    Primary reminder processor function:
    1. Scans active schedules for all active users (or specific user if passed).
    2. Generates missing MedicineLogs for valid date windows (handles server downtime catch-up).
    3. Idempotently transitions UPCOMING -> DUE (creating 1 REMINDER notification per dose).
    4. Idempotently transitions DUE -> MISSED after grace period (creating 1 ALERT notification per missed dose).
    5. Preserves TAKEN and SKIPPED statuses unconditionally.
    """
    now = timezone.now()
    today = timezone.localdate() if hasattr(timezone, 'localdate') else now.date()

    grace_minutes = getattr(settings, 'MISSED_DOSE_GRACE_MINUTES', 120)
    grace_period = timedelta(minutes=grace_minutes)

    # Filter active schedules
    schedule_qs = MedicineSchedule.objects.filter(is_active=True, medicine__is_active=True)
    if user:
        schedule_qs = schedule_qs.filter(user=user)

    stats = {
        'logs_created': 0,
        'due_count': 0,
        'missed_count': 0,
        'reminder_notifications_sent': 0,
        'alert_notifications_sent': 0
    }

    with transaction.atomic():
        for schedule in schedule_qs:
            # Determine valid date range for catch-up window (max 7 days back to avoid unlimited historical logs)
            sched_date = timezone.localdate(schedule.created_at) if hasattr(timezone, 'localdate') else schedule.created_at.date()
            start_date = max(today - timedelta(days=7), sched_date)
            curr_date = start_date

            while curr_date <= today:
                occurrences = get_schedule_occurrences(schedule, curr_date)
                compartment_num = schedule.compartment.compartment_number if schedule.compartment else 1

                # Reconcile any existing UPCOMING logs for this schedule on curr_date
                existing_upcoming = list(
                    MedicineLog.objects.filter(
                        user=schedule.user,
                        schedule=schedule,
                        scheduled_time__date=curr_date,
                        status='UPCOMING'
                    )
                )

                needed_occurrences = list(occurrences)

                # Check occurrences that already have matching logs
                matched_occurrences = set()
                for occ in needed_occurrences:
                    if MedicineLog.objects.filter(user=schedule.user, schedule=schedule, scheduled_time=occ).exists():
                        matched_occurrences.add(occ)

                unmatched_occurrences = [occ for occ in needed_occurrences if occ not in matched_occurrences]
                stale_upcoming = [l for l in existing_upcoming if l.scheduled_time not in occurrences]

                for stale_log in stale_upcoming:
                    if unmatched_occurrences:
                        new_occ = unmatched_occurrences.pop(0)
                        stale_log.scheduled_time = new_occ
                        stale_log.compartment_number = compartment_num
                        stale_log.medicine = schedule.medicine
                        stale_log.save(update_fields=['scheduled_time', 'compartment_number', 'medicine'])
                    else:
                        stale_log.status = 'SKIPPED'
                        stale_log.save(update_fields=['status'])

                for dt in unmatched_occurrences:
                    # Deterministic get_or_create enforces DB-level unique_together = ('user', 'schedule', 'scheduled_time')
                    log, created = MedicineLog.objects.get_or_create(
                        user=schedule.user,
                        schedule=schedule,
                        scheduled_time=dt,
                        defaults={
                            'medicine': schedule.medicine,
                            'compartment_number': compartment_num,
                            'status': 'UPCOMING'
                        }
                    )
                    if created:
                        stats['logs_created'] += 1

                curr_date += timedelta(days=1)

        # Process log status transitions with row locking where supported
        logs_query = MedicineLog.objects.filter(status__in=['UPCOMING', 'DUE'])
        if user:
            logs_query = logs_query.filter(user=user)

        logs_to_process = logs_query.select_for_update(skip_locked=True) if settings.DATABASES['default']['ENGINE'] != 'django.db.backends.sqlite3' else logs_query

        for log in logs_to_process:
            # IMMUTABILITY GUARD: Skip TAKEN or SKIPPED logs
            if log.status in ['TAKEN', 'SKIPPED']:
                continue

            # 1. UPCOMING -> DUE Transition
            if log.status == 'UPCOMING' and log.scheduled_time <= now:
                log.status = 'DUE'
                log.save(update_fields=['status'])
                stats['due_count'] += 1

                # Idempotent Notification creation: Exactly 1 REMINDER notification per MedicineLog
                notif, notif_created = Notification.objects.get_or_create(
                    user=log.user,
                    medicine_log=log,
                    type='REMINDER',
                    defaults={
                        'title': f"Time for {log.medicine.name}",
                        'message': f"Please take {log.medicine.name} ({log.medicine.dosage}) from Compartment {log.compartment_number}. Scheduled for {log.scheduled_time.strftime('%I:%M %p')}.",
                        'is_read': False
                    }
                )
                if notif_created:
                    stats['reminder_notifications_sent'] += 1

            # 2. DUE -> MISSED Transition (after Grace Period)
            if log.status == 'DUE' and (now - log.scheduled_time) >= grace_period:
                log.status = 'MISSED'
                log.save(update_fields=['status'])
                stats['missed_count'] += 1

                # Idempotent Alert Notification creation: Exactly 1 ALERT notification per missed MedicineLog
                notif, notif_created = Notification.objects.get_or_create(
                    user=log.user,
                    medicine_log=log,
                    type='ALERT',
                    defaults={
                        'title': f"Missed Dose: {log.medicine.name}",
                        'message': f"The scheduled dose for {log.medicine.name} ({log.medicine.dosage}) from Compartment {log.compartment_number} at {log.scheduled_time.strftime('%I:%M %p')} was marked as MISSED.",
                        'is_read': False
                    }
                )
                if notif_created:
                    stats['alert_notifications_sent'] += 1

    return stats

def generate_today_logs_for_user(user):
    """
    Backward-compatible wrapper for user-specific API calls.
    Invokes process_automatic_reminders(user=user) and returns today's logs.
    """
    process_automatic_reminders(user=user)
    today = timezone.localdate() if hasattr(timezone, 'localdate') else timezone.now().date()
    return MedicineLog.objects.filter(user=user, scheduled_time__date=today).order_by('scheduled_time')
