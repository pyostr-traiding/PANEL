import ast
import os
from pathlib import Path

import boto3
import pika
import redis
from dotenv import load_dotenv
from infisical_sdk import InfisicalSDKClient
from telebot import TeleBot
from PANEL.redis_conf import RedisServer


# =========================
# === LOAD ENVIROMENT ==
# =========================
load_dotenv()

client = InfisicalSDKClient(
    host=os.getenv('INFISICAL_HOST'),
    token=os.getenv('INFISICAL_TOKEN'),
    cache_ttl=300
)


def load_project_secrets(project_slug: str):
    resp = client.secrets.list_secrets(
        project_slug=project_slug,
        environment_slug=os.getenv('ENVIRONMENT_SLUG'),
        secret_path="/"
    )
    return {s['secretKey']: s['secretValue'] for s in resp.to_dict()['secrets']}

# Загружаем общие секреты
shared_secrets = load_project_secrets("shared-all")

# Загружаем проектные секреты
project_secrets = load_project_secrets("panel")

# Объединяем: проектные перезаписывают общие при совпадении ключей
all_secrets = {**shared_secrets, **project_secrets}

# Добавляем в окружение
os.environ.update(all_secrets)

# =========================
# === BASE CONFIGURATION ==
# =========================

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = ast.literal_eval(os.getenv('DEBUG', 'False'))
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

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
    'app.tasks',
    'app.abstractions',
    'app.users',
    'app.frontend',
    'app.setting',
    'app.position',
    'app.order',
]



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

MYSQL_DATABASE = os.getenv('MYSQL_DATABASE')
MYSQL_USER = os.getenv('MYSQL_USER')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
MYSQL_DATABASE_HOST = os.getenv('MYSQL_DATABASE_HOST')
MYSQL_DATABASE_PORT = os.getenv('MYSQL_DATABASE_PORT')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': MYSQL_DATABASE,
        'USER': MYSQL_USER,
        'PASSWORD': MYSQL_PASSWORD,
        'HOST': MYSQL_DATABASE_HOST,
        'PORT': MYSQL_DATABASE_PORT,
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

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL')


s3_client = boto3.resource(
    service_name='s3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
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
                'access_key': AWS_ACCESS_KEY_ID,
                'secret_key': AWS_SECRET_ACCESS_KEY,
                'bucket_name': AWS_STORAGE_BUCKET_NAME,
                'endpoint_url': AWS_S3_ENDPOINT_URL,
                'signature_version': 's3',
                'location': 'TRADE',
            },
        },
        'staticfiles': {
            'BACKEND': 'storages.backends.s3.S3Storage',
            'OPTIONS': {
                'access_key': AWS_ACCESS_KEY_ID,
                'secret_key': AWS_SECRET_ACCESS_KEY,
                'bucket_name': AWS_STORAGE_BUCKET_NAME,
                'endpoint_url': AWS_S3_ENDPOINT_URL,
                'signature_version': 's3',
                'location': 'TRADE',
            },
        },
    }

    MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/TRADE/media/"
    STATIC_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/TRADE/static/"
    STATICFILES_DIRS = [BASE_DIR / "static"]

# ======================
# === TELEGRAM =========
# ======================

TG_BOT_TOKEN = os.getenv('BOT_TOKEN')

tg_client = TeleBot(
    token=TG_BOT_TOKEN,
    parse_mode='HTML',
)

# ======================
# === RABBITMQ =========
# ======================

RABBITMQ_USERNAME = os.getenv('RABBITMQ_USERNAME')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD')
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST')
RABBITMQ_PORT = os.getenv('RABBITMQ_PORT')
RABBITMQ_VIRTUAL_HOST = os.getenv('RABBITMQ_VIRTUAL_HOST')

credentials = pika.PlainCredentials(
    username=RABBITMQ_USERNAME,
    password=RABBITMQ_PASSWORD,
)

connection_params = pika.ConnectionParameters(
    host=RABBITMQ_HOST,
    port=RABBITMQ_PORT,
    virtual_host=RABBITMQ_VIRTUAL_HOST,
    credentials=credentials,
)

# ======================
# === REDIS ============
# ======================

REDIS_HOST = os.getenv('REDIS_HOST')
REDIS_PORT = int(os.getenv('REDIS_PORT'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')

redis_server = RedisServer(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
)


# =======================
# === CHANNELS CONFIG ===
# =======================

ASGI_APPLICATION = 'PANEL.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}"
            ],
        },
    },
}

# ======================
# === CELERY ===========
# ======================

CELERY_BROKER_URL = (
    f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/44"
)
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_RESULT_EXTENDED = True
CELERY_BEAT_MAX_LOOP_INTERVAL = 1  # сек



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
