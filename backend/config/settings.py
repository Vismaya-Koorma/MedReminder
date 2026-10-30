import os
from pathlib import Path
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present (only when not running on Render)
if not os.getenv('RENDER'):
    load_dotenv(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
if os.getenv('RENDER'):
    secret_key_env = os.getenv('SECRET_KEY', '').strip()
    if not secret_key_env:
        raise ImproperlyConfigured("The SECRET_KEY environment variable is required in production.")
    SECRET_KEY = secret_key_env
else:
    SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-medicine-reminder-secret-key-change-in-prod')

# SECURITY WARNING: don't run with debug turned on in production!
if os.getenv('RENDER'):
    DEBUG = os.getenv('DEBUG', 'False').strip().lower() in ('true', '1', 'yes')
else:
    DEBUG = os.getenv('DEBUG', 'True').strip().lower() in ('true', '1', 'yes')

# ALLOWED_HOSTS configuration
allowed_hosts_env = os.getenv('ALLOWED_HOSTS')
if allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_env.split(',') if h.strip()]
else:
    # Default hosts for local development
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', 'testserver']
    if DEBUG:
        ALLOWED_HOSTS.append('*')

render_hostname = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

if os.getenv('RENDER') and '.onrender.com' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.onrender.com')

# Known local/development origins
DEFAULT_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://10.142.100.23:5173',
    'http://10.142.100.23:8000',
]

# CSRF Trusted Origins for Render and production domains
csrf_env = os.getenv('CSRF_TRUSTED_ORIGINS', '')
if csrf_env:
    CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_env.split(',') if origin.strip()]
else:
    CSRF_TRUSTED_ORIGINS = list(DEFAULT_DEV_ORIGINS)

if render_hostname:
    render_csrf = f'https://{render_hostname}'
    if render_csrf not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_csrf)

if os.getenv('RENDER') and 'https://*.onrender.com' not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append('https://*.onrender.com')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',

    # Local apps
    'accounts',
    'medicines',
    'schedules',
    'monitoring',
    'devices',
    'notifications',
    'dashboard',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database Configuration: Render DATABASE_URL support with local environment fallback
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    try:
        import dj_database_url
        DATABASES = {
            'default': dj_database_url.config(
                default=DATABASE_URL,
                conn_max_age=600,
                conn_health_checks=True,
            )
        }
    except ImportError:
        # Fallback if dj-database-url is not yet installed
        DB_NAME = os.getenv('DB_NAME', 'medicine_reminder_db')
        DB_USER = os.getenv('DB_USER', 'postgres')
        DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
        DB_HOST = os.getenv('DB_HOST', 'localhost')
        DB_PORT = os.getenv('DB_PORT', '5432')

        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': DB_NAME,
                'USER': DB_USER,
                'PASSWORD': DB_PASSWORD,
                'HOST': DB_HOST,
                'PORT': DB_PORT,
            }
        }
else:
    DB_NAME = os.getenv('DB_NAME', 'medicine_reminder_db')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '5432')

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Django REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS Settings
cors_origins_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
if cors_origins_env:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
else:
    CORS_ALLOWED_ORIGINS = list(DEFAULT_DEV_ORIGINS)

if render_hostname:
    render_cors = f'https://{render_hostname}'
    if render_cors not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(render_cors)

# In development, allow all origins to ease testing across local devices/ESP32.
# In production (DEBUG=False), enforce CORS_ALLOWED_ORIGINS.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False

# Reverse proxy SSL header for Render deployment
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('TIME_ZONE', 'Asia/Kolkata')
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images) with WhiteNoise support for production
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Automatic Medicine Reminder Engine Configuration
try:
    MISSED_DOSE_GRACE_MINUTES = int(os.getenv('MISSED_DOSE_GRACE_MINUTES', 120))
    if MISSED_DOSE_GRACE_MINUTES <= 0:
        MISSED_DOSE_GRACE_MINUTES = 120
except (ValueError, TypeError):
    MISSED_DOSE_GRACE_MINUTES = 120

try:
    REMINDER_CHECK_INTERVAL_SECONDS = int(os.getenv('REMINDER_CHECK_INTERVAL_SECONDS', 60))
    if REMINDER_CHECK_INTERVAL_SECONDS <= 0:
        REMINDER_CHECK_INTERVAL_SECONDS = 60
except (ValueError, TypeError):
    REMINDER_CHECK_INTERVAL_SECONDS = 60
