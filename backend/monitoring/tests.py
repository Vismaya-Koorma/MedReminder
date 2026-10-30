from datetime import datetime, timedelta, time
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.utils import timezone
from django.contrib.auth.models import User
from medicines.models import Medicine, MedicineCompartment
from schedules.models import MedicineSchedule
from monitoring.models import MedicineLog
from notifications.models import Notification
from monitoring.services import process_automatic_reminders, get_schedule_occurrences

class AutomaticReminderEngineTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='patient1', password='Password123!')
        self.user2 = User.objects.create_user(username='patient2', password='Password123!')

        self.medicine1 = Medicine.objects.create(
            user=self.user1,
            name='Paracetamol',
            dosage='500mg',
            medicine_type='TABLET'
        )
        self.medicine2 = Medicine.objects.create(
            user=self.user2,
            name='Insulin',
            dosage='10 units',
            medicine_type='INJECTION'
        )

        self.compartment1 = MedicineCompartment.objects.create(
            user=self.user1,
            compartment_number=1,
            assigned_medicine=self.medicine1,
            status='AVAILABLE'
        )
        self.compartment2 = MedicineCompartment.objects.create(
            user=self.user2,
            compartment_number=2,
            assigned_medicine=self.medicine2,
            status='AVAILABLE'
        )

        now = timezone.localtime()
        self.schedule1 = MedicineSchedule.objects.create(
            user=self.user1,
            medicine=self.medicine1,
            compartment=self.compartment1,
            schedule_time=(now - timedelta(minutes=10)).time(),
            frequency='DAILY',
            dosage='500mg',
            is_active=True
        )

    def test_upcoming_to_due_transition(self):
        """Doses transition to DUE when scheduled_time <= now and generate 1 REMINDER notification."""
        now = timezone.localtime()
        past_time = now - timedelta(minutes=10)

        log = MedicineLog.objects.create(
            user=self.user1,
            schedule=self.schedule1,
            medicine=self.medicine1,
            compartment_number=1,
            scheduled_time=past_time,
            status='UPCOMING'
        )

        stats = process_automatic_reminders()

        log.refresh_from_db()
        self.assertEqual(log.status, 'DUE')
        self.assertGreaterEqual(stats['due_count'], 1)

        # Verify notification linked to medicine_log
        notif = Notification.objects.get(user=self.user1, medicine_log=log, type='REMINDER')
        self.assertIn('Paracetamol', notif.title)
        self.assertFalse(notif.is_read)

    @override_settings(MISSED_DOSE_GRACE_MINUTES=60)
    def test_missed_dose_handling(self):
        """DUE doses exceeding grace period transition to MISSED and create an ALERT notification."""
        now = timezone.now()
        overdue_time = now - timedelta(minutes=90)  # Exceeds 60 min grace period

        # Create log directly in DUE state for overdue time
        log = MedicineLog.objects.create(
            user=self.user1,
            schedule=self.schedule1,
            medicine=self.medicine1,
            compartment_number=1,
            scheduled_time=overdue_time,
            status='DUE'
        )

        stats = process_automatic_reminders()

        log.refresh_from_db()
        self.assertEqual(log.status, 'MISSED')
        self.assertGreaterEqual(stats['missed_count'], 1)

        alert_notif = Notification.objects.get(user=self.user1, medicine_log=log, type='ALERT')
        self.assertIn('Missed Dose', alert_notif.title)

    @override_settings(MISSED_DOSE_GRACE_MINUTES=30)
    def test_taken_and_skipped_immutability(self):
        """TAKEN or SKIPPED doses remain unchanged even after grace period expires."""
        now = timezone.now()
        past_time = now - timedelta(hours=5)

        taken_log = MedicineLog.objects.create(
            user=self.user1,
            schedule=self.schedule1,
            medicine=self.medicine1,
            compartment_number=1,
            scheduled_time=past_time,
            status='TAKEN',
            taken_time=past_time + timedelta(minutes=10)
        )

        skipped_log = MedicineLog.objects.create(
            user=self.user1,
            schedule=self.schedule1,
            medicine=self.medicine1,
            compartment_number=1,
            scheduled_time=past_time - timedelta(hours=1),
            status='SKIPPED'
        )

        process_automatic_reminders()

        taken_log.refresh_from_db()
        skipped_log.refresh_from_db()

        self.assertEqual(taken_log.status, 'TAKEN')
        self.assertEqual(skipped_log.status, 'SKIPPED')
        self.assertFalse(Notification.objects.filter(medicine_log=taken_log, type='ALERT').exists())

    def test_duplicate_notifications_suppression(self):
        """Repeated engine runs do not create duplicate REMINDER or ALERT notifications."""
        now = timezone.now()
        past_time = now - timedelta(minutes=15)

        log = MedicineLog.objects.create(
            user=self.user1,
            schedule=self.schedule1,
            medicine=self.medicine1,
            compartment_number=1,
            scheduled_time=past_time,
            status='UPCOMING'
        )

        # Run engine 3 times consecutively
        stats1 = process_automatic_reminders()
        stats2 = process_automatic_reminders()
        stats3 = process_automatic_reminders()

        log.refresh_from_db()
        reminders = Notification.objects.filter(user=self.user1, medicine_log=log, type='REMINDER')

        self.assertEqual(reminders.count(), 1)
        self.assertEqual(stats2['reminder_notifications_sent'], 0)
        self.assertEqual(stats3['reminder_notifications_sent'], 0)

    def test_duplicate_logs_prevention(self):
        """Unique constraint on (user, schedule, scheduled_time) prevents duplicate logs."""
        now = timezone.now()
        target_date = now.date()
        dt = timezone.make_aware(datetime.combine(target_date, time(8, 0, 0)))

        log1, created1 = MedicineLog.objects.get_or_create(
            user=self.user1,
            schedule=self.schedule1,
            scheduled_time=dt,
            defaults={'medicine': self.medicine1, 'compartment_number': 1, 'status': 'UPCOMING'}
        )
        self.assertTrue(created1)

        log2, created2 = MedicineLog.objects.get_or_create(
            user=self.user1,
            schedule=self.schedule1,
            scheduled_time=dt,
            defaults={'medicine': self.medicine1, 'compartment_number': 1, 'status': 'UPCOMING'}
        )
        self.assertFalse(created2)
        self.assertEqual(log1.id, log2.id)

    @override_settings(MISSED_DOSE_GRACE_MINUTES=60)
    def test_server_restart_recovery_past_doses(self):
        """Catch-up window correctly processes overdue doses after server restart without unlimited historical records."""
        now = timezone.localtime()
        two_days_ago = now - timedelta(days=2)
        past_time = (now - timedelta(hours=3)).time()

        old_schedule = MedicineSchedule.objects.create(
            user=self.user1,
            medicine=self.medicine1,
            compartment=self.compartment1,
            schedule_time=past_time,
            frequency='DAILY',
            is_active=True
        )
        MedicineSchedule.objects.filter(id=old_schedule.id).update(created_at=two_days_ago)
        old_schedule.refresh_from_db()

        stats = process_automatic_reminders()

        # Verify old logs were caught up and marked MISSED
        missed_logs = MedicineLog.objects.filter(user=self.user1, schedule=old_schedule, status='MISSED')
        self.assertGreaterEqual(missed_logs.count(), 1)

    def test_multiple_users_isolation(self):
        """Engine processes multiple users in isolation without data leakage."""
        target_time = time(8, 0, 0)
        self.schedule1.schedule_time = target_time
        self.schedule1.save()

        schedule2 = MedicineSchedule.objects.create(
            user=self.user2,
            medicine=self.medicine2,
            compartment=self.compartment2,
            schedule_time=target_time,
            frequency='DAILY',
            is_active=True
        )

        stats = process_automatic_reminders()

        log1 = MedicineLog.objects.filter(user=self.user1, schedule=self.schedule1).first()
        log2 = MedicineLog.objects.filter(user=self.user2, schedule=schedule2).first()

        self.assertIsNotNone(log1)
        self.assertIsNotNone(log2)
        self.assertEqual(log1.user, self.user1)
        self.assertEqual(log2.user, self.user2)

    def test_schedule_frequency_boundaries(self):
        """Verifies schedule occurrences generation for ONCE, TWICE_DAILY, and THREE_TIMES_DAILY."""
        now = timezone.now()
        target_date = now.date()

        schedule_twice = MedicineSchedule.objects.create(
            user=self.user1,
            medicine=self.medicine1,
            compartment=self.compartment1,
            schedule_time=time(8, 0, 0),
            frequency='TWICE_DAILY',
            is_active=True
        )
        occ_twice = get_schedule_occurrences(schedule_twice, target_date)
        self.assertEqual(len(occ_twice), 2)
        self.assertEqual(occ_twice[1] - occ_twice[0], timedelta(hours=12))

        schedule_thrice = MedicineSchedule.objects.create(
            user=self.user1,
            medicine=self.medicine1,
            compartment=self.compartment1,
            schedule_time=time(8, 0, 0),
            frequency='THREE_TIMES_DAILY',
            is_active=True
        )
        occ_thrice = get_schedule_occurrences(schedule_thrice, target_date)
        self.assertEqual(len(occ_thrice), 3)

    def test_device_event_integration_prevents_missed(self):
        """Device MEDICINE_TAKEN event updates log to TAKEN and prevents subsequent engine runs from marking it MISSED."""
        now = timezone.localtime()
        due_time = now - timedelta(minutes=15)
        self.schedule1.schedule_time = due_time.time()
        self.schedule1.save()

        # Initial run makes it DUE
        process_automatic_reminders()
        log = MedicineLog.objects.get(user=self.user1, schedule=self.schedule1)
        self.assertEqual(log.status, 'DUE')

        # Simulate device event marking log TAKEN
        log.status = 'TAKEN'
        log.taken_time = timezone.now()
        log.save()

        # Subsequent engine run with expired grace period
        with override_settings(MISSED_DOSE_GRACE_MINUTES=5):
            process_automatic_reminders()

        log.refresh_from_db()
        self.assertEqual(log.status, 'TAKEN')

    def test_medicine_log_serializer_fields(self):
        """Serializer includes top-level medicine_name and dosage for Dashboard consumption."""
        from monitoring.serializers import MedicineLogSerializer
        log = MedicineLog.objects.create(
            user=self.user1,
            medicine=self.medicine1,
            scheduled_time=timezone.now(),
            status='DUE',
            compartment_number=1
        )
        data = MedicineLogSerializer(log).data
        self.assertEqual(data['medicine_name'], self.medicine1.name)
        self.assertEqual(data['dosage'], self.medicine1.dosage)
        self.assertIn('medicine_detail', data)

    def test_schedule_update_reconciles_stale_upcoming_logs(self):
        """Updating schedule time re-aligns existing UPCOMING dose log rather than duplicating."""
        now = timezone.localtime()
        time1 = (now + timedelta(hours=2)).time()
        time2 = (now + timedelta(hours=3)).time()

        schedule = MedicineSchedule.objects.create(
            user=self.user1,
            medicine=self.medicine1,
            schedule_time=time1,
            frequency='DAILY',
            is_active=True
        )
        process_automatic_reminders(user=self.user1)

        # 1 upcoming log exists for time1
        logs = MedicineLog.objects.filter(user=self.user1, schedule=schedule, status='UPCOMING')
        self.assertEqual(logs.count(), 1)
        self.assertEqual(timezone.localtime(logs.first().scheduled_time).time().hour, time1.hour)

        # User updates schedule time to time2
        schedule.schedule_time = time2
        schedule.save()
        process_automatic_reminders(user=self.user1)

        # Re-aligned to time2, no duplicate active upcoming rows
        updated_logs = MedicineLog.objects.filter(user=self.user1, schedule=schedule, status='UPCOMING')
        self.assertEqual(updated_logs.count(), 1)
        self.assertEqual(timezone.localtime(updated_logs.first().scheduled_time).time().hour, time2.hour)
