from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import time, timedelta
from medicines.models import Medicine, MedicineCompartment
from schedules.models import MedicineSchedule
from monitoring.models import MedicineLog
from monitoring.services import generate_today_logs_for_user
from devices.models import Device, DeviceEvent
from notifications.models import Notification

class MedicineSystemBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', password='password123', email='user1@example.com')
        self.user2 = User.objects.create_user(username='user2', password='password123', email='user2@example.com')
        self.client.force_authenticate(user=self.user1)

        # Ensure default 4 compartments exist for user1 and user2
        for num in range(1, 5):
            MedicineCompartment.objects.get_or_create(user=self.user1, compartment_number=num, defaults={'status': 'EMPTY'})
            MedicineCompartment.objects.get_or_create(user=self.user2, compartment_number=num, defaults={'status': 'EMPTY'})

    # 1. Registration
    def test_user_registration(self):
        response = self.client.post('/api/accounts/register/', {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'password123',
            'role': 'PATIENT',
            'phone': '1234567890'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertIn('token', response.data['data'])

    # 2. Login
    def test_user_login(self):
        response = self.client.post('/api/accounts/login/', {
            'username': 'user1',
            'password': 'password123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('token', response.data['data'])

    # 3. Medicine creation
    def test_medicine_creation(self):
        response = self.client.post('/api/medicines/', {
            'name': 'Paracetamol',
            'generic_name': 'Acetaminophen',
            'dosage': '500 mg',
            'medicine_type': 'TABLET',
            'description': 'Pain reliever'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Medicine.objects.count(), 1)
        self.assertEqual(Medicine.objects.first().user, self.user1)

    # 4. Medicine ownership
    def test_medicine_ownership(self):
        med1 = Medicine.objects.create(user=self.user1, name='User1 Med', dosage='100mg')
        med2 = Medicine.objects.create(user=self.user2, name='User2 Med', dosage='200mg')

        response = self.client.get('/api/medicines/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        med_ids = [m['id'] for m in response.data]
        self.assertIn(med1.id, med_ids)
        self.assertNotIn(med2.id, med_ids)

    # 5. Compartment validation
    def test_compartment_validation(self):
        response = self.client.get('/api/compartments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

        comp1 = MedicineCompartment.objects.get(user=self.user1, compartment_number=1)
        med_user2 = Medicine.objects.create(user=self.user2, name='Other Med', dosage='100mg')

        # Try assigning user2 medicine to user1 compartment
        resp = self.client.patch(f'/api/compartments/{comp1.id}/', {
            'assigned_medicine': med_user2.id
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # 6. Schedule creation
    def test_schedule_creation(self):
        med = Medicine.objects.create(user=self.user1, name='Aspirin', dosage='1 tablet')
        comp = MedicineCompartment.objects.get(user=self.user1, compartment_number=1)
        comp.assigned_medicine = med
        comp.save()

        response = self.client.post('/api/schedules/', {
            'medicine': med.id,
            'compartment': comp.id,
            'schedule_time': '08:00:00',
            'frequency': 'DAILY',
            'dosage': '1 tablet'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MedicineSchedule.objects.count(), 1)

    # 7. Duplicate MedicineLog prevention
    def test_duplicate_medicine_log_prevention(self):
        med = Medicine.objects.create(user=self.user1, name='Vitamin D', dosage='1000 IU')
        schedule = MedicineSchedule.objects.create(
            user=self.user1, medicine=med, schedule_time=time(9, 0), frequency='DAILY', dosage='1 pill'
        )

        logs1 = generate_today_logs_for_user(self.user1)
        count1 = MedicineLog.objects.filter(user=self.user1, schedule=schedule).count()

        logs2 = generate_today_logs_for_user(self.user1)
        count2 = MedicineLog.objects.filter(user=self.user1, schedule=schedule).count()

        self.assertEqual(count1, count2)
        self.assertEqual(count1, 1)

    # 8. Device registration
    def test_device_registration(self):
        response = self.client.post('/api/devices/register/', {
            'device_id': 'MED-TEST-001',
            'device_name': 'Test Dispenser'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Device.objects.filter(device_id='MED-TEST-001').count(), 1)

    # 9. Device heartbeat
    def test_device_heartbeat(self):
        device, _ = Device.objects.get_or_create(device_id='MED-001', defaults={'user': self.user1, 'status': 'OFFLINE'})
        unauthenticated_client = APIClient()  # Device heartbeat can be public
        response = unauthenticated_client.post('/api/devices/heartbeat/', {
            'device_id': 'MED-001',
            'battery_level': 88,
            'wifi_status': 'Connected',
            'firmware_version': '1.0.1'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        device.refresh_from_db()
        self.assertEqual(device.battery_level, 88)
        self.assertEqual(device.status, 'ONLINE')

    # 10, 11, 12. MEDICINE_TAKEN event, status change to TAKEN, and Notification creation
    def test_medicine_taken_event_flow(self):
        med = Medicine.objects.create(user=self.user1, name='Paracetamol', dosage='500mg')
        comp = MedicineCompartment.objects.get(user=self.user1, compartment_number=1)
        now = timezone.localtime()
        schedule = MedicineSchedule.objects.create(
            user=self.user1, medicine=med, compartment=comp, schedule_time=(now - timedelta(minutes=10)).time(), frequency='DAILY', dosage='1 pill'
        )
        device, _ = Device.objects.get_or_create(device_id='MED-001', defaults={'user': self.user1, 'status': 'ONLINE'})

        # Generate log & force status DUE
        generate_today_logs_for_user(self.user1)
        log = MedicineLog.objects.get(user=self.user1, schedule=schedule)
        log.status = 'DUE'
        log.compartment_number = 1
        log.save()

        # Simulate device sending MEDICINE_TAKEN event
        response = self.client.post('/api/devices/medicine-event/', {
            'device_id': 'MED-001',
            'compartment': 1,
            'event': 'medicine_taken'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        log.refresh_from_db()
        self.assertEqual(log.status, 'TAKEN')
        self.assertIsNotNone(log.taken_time)

        # Check Notification was created
        self.assertTrue(Notification.objects.filter(user=self.user1, title__icontains='Medicine Taken').exists())

    # 13. User data isolation
    def test_user_data_isolation(self):
        med_user2 = Medicine.objects.create(user=self.user2, name='Secret Med User2', dosage='50mg')

        response = self.client.get(f'/api/medicines/{med_user2.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 14. Unauthorized device event rejection
    def test_unauthorized_device_event_rejection(self):
        # User2 device
        dev_user2 = Device.objects.create(device_id='MED-USER2', user=self.user2, status='ONLINE')

        # User1 attempts to trigger event on User2 device
        response = self.client.post('/api/devices/medicine-event/', {
            'device_id': 'MED-USER2',
            'compartment': 1,
            'event': 'medicine_taken'
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 15. Reminder due check and LED status flow
    def test_device_reminder_due_and_taken_flow(self):
        # Create medicine and schedule
        med = Medicine.objects.create(user=self.user1, name='Aspirin', dosage='100mg')
        now = timezone.localtime()

        # Step 1: No due logs initially
        res = self.client.get('/api/devices/reminder-due/?compartment=1')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['is_reminder_due'])

        # Step 2: Create a schedule due in the past (so it transitions to DUE)
        schedule = MedicineSchedule.objects.create(
            user=self.user1,
            medicine=med,
            schedule_time=(now - timezone.timedelta(minutes=5)).time(),
            frequency='ONCE_DAILY',
            is_active=True
        )

        res = self.client.get('/api/devices/reminder-due/?compartment=1')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['is_reminder_due'])
        self.assertEqual(res.data['due_count'], 1)

        # Step 3: Register device and mark medicine taken
        Device.objects.get_or_create(device_id='MED-001', defaults={'user': self.user1, 'status': 'ONLINE'})
        take_res = self.client.post('/api/devices/medicine-event/', {
            'device_id': 'MED-001',
            'compartment': 1,
            'event': 'MEDICINE_TAKEN'
        })
        self.assertEqual(take_res.status_code, status.HTTP_200_OK)

        # Step 4: After medicine taken, reminder is no longer due -> LED turns off
        res_after = self.client.get('/api/devices/reminder-due/?compartment=1')
        self.assertEqual(res_after.status_code, status.HTTP_200_OK)
        self.assertFalse(res_after.data['is_reminder_due'])

    # 16. Hand detection / REMINDER_ACKNOWLEDGED event flow
    def test_reminder_acknowledged_event_flow(self):
        device, _ = Device.objects.get_or_create(device_id='MED-001', defaults={'user': self.user1, 'status': 'ONLINE'})
        response = self.client.post('/api/devices/compartment-event/', {
            'device_id': 'MED-001',
            'compartment': 1,
            'event': 'REMINDER_ACKNOWLEDGED'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['event_type'], 'REMINDER_ACKNOWLEDGED')

        # Verify DeviceEvent recorded
        self.assertTrue(DeviceEvent.objects.filter(device=device, event_type='REMINDER_ACKNOWLEDGED').exists())

        # Verify Notification created distinguishing acknowledgement from taken
        notif = Notification.objects.filter(user=self.user1, title__icontains='Reminder Acknowledged').first()
        self.assertIsNotNone(notif)
        self.assertIn('pending medicine confirmation', notif.message)
