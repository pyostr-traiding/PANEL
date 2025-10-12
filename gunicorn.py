import multiprocessing

# Количество рабочих процессов
workers = multiprocessing.cpu_count() * 2 + 1
# workers = 1

# Адрес и порт, на котором будет запущен Gunicorn
bind = '0.0.0.0:8000'

# Уровень логирования
loglevel = 'debug'

# Имя Django-проекта
wsgi_app = 'PANEL.wsgi:application'

# Таймауты
timeout = 120

# Перезапуск workers после обработки указанного количества запросов
max_requests = 1000
max_requests_jitter = 50

# Путь к файлу с логами (необязательно)
# accesslog = '/path/to/your/logs/gunicorn_access.log'
errorlog = 'gunicorn_error.log'

# Перезапуск workers при изменении кода (удобно для разработки)
reload = True
