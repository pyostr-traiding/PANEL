"""
Abstraction models
"""
from django.core.exceptions import ObjectDoesNotExist
from django.db import models


class GetOrNoneManager(models.Manager):

    def get_or_none(self, **kwargs):
        try:
            return self.get(**kwargs)
        except ObjectDoesNotExist:
            return []


class AbstractModel(models.Model):
    """
    Abstract DB model
    """

    class Meta:
        abstract = True
    objects = GetOrNoneManager()

    created_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Дата создания',
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Дата обновления',
    )

    def __str__(self):
        return str(self.created_at)