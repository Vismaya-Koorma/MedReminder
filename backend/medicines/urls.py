from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicineViewSet, CompartmentViewSet

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'compartments', CompartmentViewSet, basename='compartment')

urlpatterns = [
    path('', include(router.urls)),
]
