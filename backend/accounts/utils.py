from django.contrib.auth.models import User
from devices.models import Device

def get_target_patient_user(user):
    """
    If the requesting user is a CAREGIVER, return the patient they are caring for.
    Defaults to the patient connected to the physical dispenser (MED-001) or 'anu'.
    If the user is a PATIENT or no patient profile exists, returns the user itself.
    """
    if hasattr(user, 'profile') and user.profile.role == 'CAREGIVER':
        # 1. Prioritize user linked to physical hardware device MED-001
        med_001 = Device.objects.filter(device_id='MED-001').first()
        if med_001 and med_001.user:
            return med_001.user

        # 2. Match patient 'anu'
        anu = User.objects.filter(username='anu').first()
        if anu:
            return anu

        # 3. Match any real registered patient (excluding e2e test users)
        real_patient = User.objects.filter(profile__role='PATIENT').exclude(username__startswith='e2e_').first()
        if real_patient:
            return real_patient

        # 4. Fallback to any patient
        any_patient = User.objects.filter(profile__role='PATIENT').first()
        if any_patient:
            return any_patient

    return user
