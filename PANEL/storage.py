from abc import ABC

from storages.backends.s3boto3 import S3Boto3Storage


class StaticStorage(S3Boto3Storage, ABC):
    location = 'TRADE/static'
    default_acl = 'public-read'


class PublicMediaStorage(S3Boto3Storage, ABC):
    location = 'TRADE/media'
    default_acl = 'public-read'
    file_overwrite = False