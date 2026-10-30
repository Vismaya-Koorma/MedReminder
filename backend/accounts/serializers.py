from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile

class UserProfileSerializer(serializers.ModelResourceSerializer if hasattr(serializers, 'ModelResourceSerializer') else serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('role', 'phone', 'emergency_contact', 'created_at')

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'profile')

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, default='PATIENT')
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    emergency_contact = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        role = validated_data.pop('role', 'PATIENT')
        phone = validated_data.pop('phone', '')
        emergency_contact = validated_data.pop('emergency_contact', '')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        UserProfile.objects.create(
            user=user,
            role=role,
            phone=phone,
            emergency_contact=emergency_contact
        )
        return user
