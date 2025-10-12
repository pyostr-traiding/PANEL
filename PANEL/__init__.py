import pymysql

from dotenv import load_dotenv
from PANEL.celery_conf import app as celery_app

load_dotenv()

pymysql.install_as_MySQLdb()
pymysql.version_info = (2, 1, 1, "final", 0)

__all__ = ('celery_app',)
