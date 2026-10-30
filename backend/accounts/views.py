from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login
from .serializers import RegisterSerializer, UserSerializer

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            user_data = UserSerializer(user).data
            return Response({
                "success": True,
                "message": "User registered successfully",
                "data": {
                    "token": token.key,
                    "user": user_data
                }
            }, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "message": "Registration failed",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({
                "success": False,
                "message": "Username and password are required"
            }, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=username, password=password)
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            user_data = UserSerializer(user).data
            return Response({
                "success": True,
                "message": "Login successful",
                "data": {
                    "token": token.key,
                    "user": user_data
                }
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Invalid credentials"
        }, status=status.HTTP_401_UNAUTHORIZED)

class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_data = UserSerializer(request.user).data
        return Response({
            "success": True,
            "message": "User profile retrieved successfully",
            "data": user_data
        }, status=status.HTTP_200_OK)
