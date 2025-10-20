# Generated manually because makemigrations is unavailable in the execution environment.
import uuid

from django.db import migrations, models
import django.db.models.deletion

import app.position.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('position', '0005_positionmodel_qty_tokens'),
        ('setting', '0004_rename_qty_symbolmodel_qty_usdt_for_order'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now=True, verbose_name='Дата создания')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Дата обновления')),
                ('uuid', models.UUIDField(default=uuid.uuid4, editable=False, unique=True, verbose_name='UUID')),
                ('category', models.CharField(max_length=20, validators=[app.position.models.validate_category], verbose_name='Рынок')),
                ('side', models.CharField(max_length=6, validators=[app.position.models.validate_side], verbose_name='Сторона')),
                ('price', models.CharField(max_length=255, verbose_name='Цена')),
                ('qty_tokens', models.CharField(max_length=255, verbose_name='Кол-во токенов')),
                ('is_test', models.BooleanField(verbose_name='Тестовая сделка')),
                ('position', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='order', to='position.positionmodel', verbose_name='Позиция')),
                ('symbol', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='setting.symbolmodel', verbose_name='Символ')),
            ],
            options={
                'verbose_name': 'Ордер',
                'verbose_name_plural': 'Ордеры',
            },
        ),
    ]
