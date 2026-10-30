from django.urls import path
from .views import (
    DeviceListView, DeviceRegisterView, DeviceHeartbeatView,
    DeviceStatusView, DeviceMedicineEventView, DeviceCompartmentEventView,
    DeviceReminderDueView
)

urlpatterns = [
    path('', DeviceListView.as_view(), name='device-list'),
    path('register/', DeviceRegisterView.as_view(), name='device-register'),
    path('heartbeat/', DeviceHeartbeatView.as_view(), name='device-heartbeat'),
    path('status/', DeviceStatusView.as_view(), name='device-status'),
    path('reminder-due/', DeviceReminderDueView.as_view(), name='device-reminder-due'),
    path('medicine-event/', DeviceMedicineEventView.as_view(), name='device-medicine-event'),
    path('compartment-event/', DeviceCompartmentEventView.as_view(), name='device-compartment-event'),
]
