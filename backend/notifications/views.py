from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user)
        serializer = NotificationSerializer(notifications, many=True)
        return Response({
            "success": True,
            "message": "Notifications retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({
                "success": True,
                "message": "Notification marked as read",
                "data": NotificationSerializer(notification).data
            }, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({
                "success": False,
                "message": "Notification not found"
            }, status=status.HTTP_404_NOT_FOUND)
