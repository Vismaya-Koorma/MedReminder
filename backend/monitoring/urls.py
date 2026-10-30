from django.urls import path
from .views import TodayMonitoringView, HistoryMonitoringView, AdherenceMonitoringView

urlpatterns = [
    path('today/', TodayMonitoringView.as_view(), name='monitoring-today'),
    path('history/', HistoryMonitoringView.as_view(), name='monitoring-history'),
    path('adherence/', AdherenceMonitoringView.as_view(), name='monitoring-adherence'),
]
