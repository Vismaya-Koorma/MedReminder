from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicineScheduleViewSet

router = DefaultRouter()
router.register(r'schedules', MedicineScheduleViewSet, basename='schedule')

urlpatterns = [
    path('', include(router.urls)),
]
