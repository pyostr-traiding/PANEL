import ast
import os
from pathlib import Path

import boto3
import pika
import redis
from dotenv import load_dotenv
from telebot import TeleBot
from PANEL.redis_conf import RedisServer


# =========================
# === BASE CONFIGURATION ==
# =========================

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = ast.literal_eval(os.getenv('DEBUG', 'False'))
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')
ALLOWED_HOSTS.append('admin-panel')

# ======================
# === DJANGO APPS ======
# ======================

INSTALLED_APPS = [
    # --- Admin & system ---
    'grappelli',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # --- Third-party ---
    'corsheaders',
    'django_celery_beat',
    'channels',
    'django_json_widget',

    # --- Local apps ---
    'app.abstractions',
    'app.users',
    'app.frontend',
    'app.setting',
    'app.position',
    'app.order',
]

# =======================
# === CHANNELS CONFIG ===
# =======================

ASGI_APPLICATION = 'PANEL.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                f"redis://:{os.getenv('REDIS_PASSWORD')}@{os.getenv('REDIS_HOST')}:{os.getenv('REDIS_PORT')}"
            ],
        },
    },
}

# ======================
# === MIDDLEWARE =======
# ======================

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ======================
# === URLS & TEMPLATES =
# ======================

ROOT_URLCONF = 'PANEL.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
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

WSGI_APPLICATION = 'PANEL.wsgi.application'

# ======================
# === DATABASE =========
# ======================

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('MYSQL_DATABASE'),
        'USER': os.getenv('MYSQL_USER'),
        'PASSWORD': os.getenv('MYSQL_PASSWORD'),
        'HOST': os.getenv('MYSQL_DATABASE_HOST'),
        'PORT': os.getenv('MYSQL_DATABASE_PORT'),
        'OPTIONS': {
            'charset': 'utf8mb4',
            'use_unicode': True,
            'sql_mode': 'traditional',
            'isolation_level': 'serializable',
        },
    }
}

# ======================
# === AUTH & SECURITY ==
# ======================

AUTH_USER_MODEL = 'auth.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ======================
# === LOCALIZATION =====
# ======================

LANGUAGE_CODE = 'ru'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000

# ======================
# === SECURITY & CORS ==
# ======================

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',')
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'False').lower() in ['true', '1', 'yes']
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = os.getenv('CORS_ALLOW_METHODS', 'GET,POST,OPTIONS,PUT,DELETE').split(',')
CORS_ALLOW_HEADERS = os.getenv('CORS_ALLOW_HEADERS', 'accept,content-type,authorization,x-csrftoken,x-requested-with').split(',')

SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = False

# ======================
# === S3 STORAGE =======
# ======================

s3_client = boto3.resource(
    service_name='s3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    endpoint_url='https://s3.timeweb.com',
)

if DEBUG:
    STATIC_URL = "static/"
    STATICFILES_DIRS = [BASE_DIR / "static"]
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"
else:
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3.S3Storage',
            'OPTIONS': {
                'access_key': os.getenv('AWS_ACCESS_KEY_ID'),
                'secret_key': os.getenv('AWS_SECRET_ACCESS_KEY'),
                'bucket_name': os.getenv('AWS_STORAGE_BUCKET_NAME'),
                'endpoint_url': os.getenv('AWS_S3_ENDPOINT_URL'),
                'signature_version': 's3',
                'location': 'TRADE',
            },
        },
        'staticfiles': {
            'BACKEND': 'storages.backends.s3.S3Storage',
            'OPTIONS': {
                'access_key': os.getenv('AWS_ACCESS_KEY_ID'),
                'secret_key': os.getenv('AWS_SECRET_ACCESS_KEY'),
                'bucket_name': os.getenv('AWS_STORAGE_BUCKET_NAME'),
                'endpoint_url': os.getenv('AWS_S3_ENDPOINT_URL'),
                'signature_version': 's3',
                'location': 'TRADE',
            },
        },
    }

    MEDIA_URL = f"{os.getenv('AWS_S3_ENDPOINT_URL')}/{os.getenv('AWS_STORAGE_BUCKET_NAME')}/TRADE/media/"
    STATIC_URL = f"{os.getenv('AWS_S3_ENDPOINT_URL')}/{os.getenv('AWS_STORAGE_BUCKET_NAME')}/TRADE/static/"
    STATICFILES_DIRS = [BASE_DIR / "static"]

# ======================
# === TELEGRAM =========
# ======================

tg_client = TeleBot(
    token=os.getenv('BOT_TOKEN'),
    parse_mode='HTML',
)

# ======================
# === RABBITMQ =========
# ======================

credentials = pika.PlainCredentials(
    username=os.getenv('RABBITMQ_USERNAME'),
    password=os.getenv('RABBITMQ_PASSWORD'),
)

connection_params = pika.ConnectionParameters(
    host=os.getenv('RABBITMQ_HOST'),
    port=int(os.getenv('RABBITMQ_PORT')),
    virtual_host=os.getenv('RABBITMQ_VIRTUAL_HOST'),
    credentials=credentials,
)

# ======================
# === CELERY ===========
# ======================

CELERY_BROKER_URL = (
    f"redis://:{os.getenv('REDIS_PASSWORD')}@{os.getenv('REDIS_HOST')}:{int(os.getenv('REDIS_PORT'))}/44"
)
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_RESULT_EXTENDED = True
CELERY_BEAT_MAX_LOOP_INTERVAL = 1  # сек

# ======================
# === REDIS ============
# ======================

redis_server = RedisServer()

# ======================
# === LOGGING ==========
# ======================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name}:{lineno} — {message}',
            'style': '{',
            'datefmt': '%d-%m-%Y %H:%M:%S',
        },
        'colored': {
            '()': 'colorlog.ColoredFormatter',
            'format': '%(log_color)s[%(asctime)s] %(levelname)s %(name)s: %(message)s',
        },
    },

    'filters': {
        'require_debug_true': {'()': 'django.utils.log.RequireDebugTrue'},
        'require_debug_false': {'()': 'django.utils.log.RequireDebugFalse'},
    },

    'handlers': {
        'console_debug': {
            'class': 'logging.StreamHandler',
            'formatter': 'colored',
            'level': 'INFO',
            'filters': ['require_debug_true'],
        },
        'console_production': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'level': 'ERROR',
            'filters': ['require_debug_false'],
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': str(BASE_DIR / 'logs' / 'panel.log'),
            'formatter': 'verbose',
            'level': 'INFO',
        },
        'rotating': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(BASE_DIR / 'logs' / 'panel_rotating.log'),
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 3,
            'formatter': 'verbose',
        },
        'mail_admins': {
            'class': 'django.utils.log.AdminEmailHandler',
            'level': 'ERROR',
        },
    },

    'loggers': {
        'django': {
            'handlers': ['console_debug'],
            'level': 'INFO',
            'propagate': True,
        },
        'app': {
            'handlers': ['console_debug', 'console_production', 'rotating'],
            'level': 'INFO',
            'propagate': False,
        },
    },

    'root': {
        'handlers': ['console_debug', 'console_production'],
        'level': 'WARNING',
    },
}

# ======================
# === COLLECTSTATIC ====
# ======================

if os.getenv('FORCE_COLLECTSTATIC', '').lower() in ['true', '1', 'yes']:
    DEBUG = False
