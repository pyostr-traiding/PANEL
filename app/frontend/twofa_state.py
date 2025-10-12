# app/security/twofa_state.py
import time

# Хранилище: user_id -> timestamp
PENDING_2FA = {}

# Добавление пользователя
def add_pending_user(user_id):
    PENDING_2FA[user_id] = time.time()

# Проверка наличия
def is_user_pending(user_id):
    return user_id in PENDING_2FA

# Удаление
def pop_pending_user(user_id):
    return PENDING_2FA.pop(user_id, None)

# Очистка старых записей (например, >5 минут)
def cleanup(timeout_seconds=300):
    now = time.time()
    expired = [uid for uid, ts in PENDING_2FA.items() if now - ts > timeout_seconds]
    for uid in expired:
        PENDING_2FA.pop(uid)
