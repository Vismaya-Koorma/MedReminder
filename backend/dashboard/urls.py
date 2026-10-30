from django.urls import path
from .views import DashboardSummaryView, WeeklyAdherenceView

urlpatterns = [
    path('summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('weekly-adherence/', WeeklyAdherenceView.as_view(), name='dashboard-weekly-adherence'),
]
