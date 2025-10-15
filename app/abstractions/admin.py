"""
Abstractions for admin panel
"""
from pprint import pprint

from django import forms
from django.contrib import admin
from django.contrib.admin.widgets import AdminFileWidget
from django.db import models

from django.utils.safestring import mark_safe
from django_json_widget.widgets import JSONEditorWidget

from app.abstractions.preview import show_preview_display

class AdminImageWidget(AdminFileWidget):
    """
    Preview for image field in admin panel
    """
    def render(self, name, value, attrs=None, renderer=None):
        output = []
        if value and getattr(value, "url", None):
            image_url = value.url
            output.append(show_preview_display(image_url))
        output.append(super(AdminFileWidget, self).render(name, value, attrs))
        return mark_safe(u''.join(output))


class ToggleSwitchWidget(forms.CheckboxInput):
    def __init__(self, attrs=None, label=None):
        super().__init__(attrs)
        self.label_text = label  # сюда будем передавать verbose_name

    def render(self, name, value, attrs=None, renderer=None):
        attrs = attrs or {}
        print(name, value, attrs)
        attrs['id'] = attrs.get('id', f'id_{name}')
        attrs['name'] = name
        attrs['type'] = 'checkbox'

        if value:
            attrs['checked'] = 'checked'

        checkbox_html = f'<input {forms.utils.flatatt(attrs)}>'

        label = self.label_text or name.replace('_', ' ').capitalize()

        toggle_html = f"""
        <style>
        .switch {{
            position: relative;
            display: inline-block;
            width: 50px;
            height: 25px;
            margin-left: 10px;
        }}
        .switch input {{
            opacity: 0;
            width: 0;
            height: 0;
        }}
        .slider {{
            position: absolute;
            cursor: pointer;
            top: 0; left: 0;
            right: 0; bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
            height: 25px;
            width: 50px;
        }}
        .slider:before {{
            position: absolute;
            content: "";
            height: 15px;
            width: 15px;
            left: 5px;
            bottom: 5px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }}
        input:checked + .slider {{
            background-color: #2196F3;
        }}
        input:checked + .slider:before {{
            transform: translateX(26px);
        }}
        </style>
        <div style="display: flex; align-items: center;">
            <label for="{attrs['id']}" style="margin-right: 10px;"><b>{label}</b></label>
            <label class="switch">
                {checkbox_html}
                <span class="slider"></span>
            </label>
        </div>
        """
        return mark_safe(toggle_html)


class AbstractAdmin(admin.ModelAdmin):
    """
    Abstract admin class
    """
    formfield_overrides = {
        models.ImageField: {
            'widget': AdminImageWidget,
        },
        models.FileField: {
            'widget': AdminImageWidget,
        },
        models.JSONField: {
            'widget': JSONEditorWidget,
        },

    }

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)

        if isinstance(db_field, models.BooleanField):
            # Передаём verbose_name в виджет, а сам label обнуляем, чтобы Django не рисовал второй
            formfield.label = ''
            formfield.widget = ToggleSwitchWidget(label=db_field.verbose_name)

        return formfield


#####################################################################
from django.contrib import admin
from django_celery_beat.models import PeriodicTask, CrontabSchedule, IntervalSchedule, SolarSchedule

# Свертываем PeriodicTask
class PeriodicTaskAdmin(admin.ModelAdmin):
    list_display = ('name', 'task', 'enabled', 'last_run_at')
    fieldsets = (
        ('Основное', {
            'fields': ('name', 'task', 'enabled'),
        }),
        ('Дополнительно', {
            'classes': ('collapse',),  # <-- свернуть блок
            'fields': (
                'interval', 'crontab', 'solar', 'args', 'kwargs', 'queue',
                'exchange', 'routing_key', 'expires', 'one_off', 'start_time', 'priority',
            ),
        }),
    )

# Свертываем расписания
class CrontabScheduleAdmin(admin.ModelAdmin):
    list_display = ('minute', 'hour', 'day_of_week', 'day_of_month', 'month_of_year')
    fieldsets = (
        (None, {
            'fields': ('minute', 'hour', 'day_of_week', 'day_of_month', 'month_of_year'),
            'classes': ('collapse',),
        }),
    )

class IntervalScheduleAdmin(admin.ModelAdmin):
    list_display = ('every', 'period')
    fieldsets = (
        (None, {
            'fields': ('every', 'period'),
            'classes': ('collapse',),
        }),
    )

class SolarScheduleAdmin(admin.ModelAdmin):
    list_display = ('event', 'latitude', 'longitude')
    fieldsets = (
        (None, {
            'fields': ('event', 'latitude', 'longitude'),
            'classes': ('collapse',),
        }),
    )

# Сначала снимаем стандартную регистрацию
admin.site.unregister(PeriodicTask)
admin.site.unregister(CrontabSchedule)
admin.site.unregister(IntervalSchedule)
admin.site.unregister(SolarSchedule)

# Регистрируем с нашими Admin-классами
admin.site.register(PeriodicTask, PeriodicTaskAdmin)
admin.site.register(CrontabSchedule, CrontabScheduleAdmin)
admin.site.register(IntervalSchedule, IntervalScheduleAdmin)
admin.site.register(SolarSchedule, SolarScheduleAdmin)


def app_resort(func):
    def inner(*args, **kwargs):
        app_list = func(*args, **kwargs)
        # app_list = [app for app in app_list if app['app_label'] not in ('otp_totp', 'otp_static')]

        app_sort_key = 'app_label'
        app_ordering = {
            'settings': 1,
            'indicators_settings': 2,
            'symbol': 3,
        }

        model_ordering = {
            'settings': [
                'documentationmodel',
                'settingsbanmodel',
            ],
            'indicators_settings': [
                'indicatorsettingsmodel',
            ],
            'symbol': [
                'symbolmodel',
            ],
        }

        # Сортируем приложения
        resorted_app_list = sorted(
            app_list,
            key=lambda x: app_ordering.get(x[app_sort_key], 1000)
        )
        # Для каждого приложения сортируем модели, если есть порядок
        for app in resorted_app_list:
            app_label = app[app_sort_key]
            if app_label in model_ordering:
                order = model_ordering[app_label]
                app['models'].sort(
                    key=lambda m: order.index(m['object_name'].lower()) if m['object_name'].lower() in order else 1000
                )

        return resorted_app_list

    return inner


admin.site.get_app_list = app_resort(admin.site.get_app_list)


