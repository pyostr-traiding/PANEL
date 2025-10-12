from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    totp_secret = models.CharField(
        max_length=60,
        blank=True, null=True,
    )