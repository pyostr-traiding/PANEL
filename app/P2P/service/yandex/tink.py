from io import BytesIO
from uuid import uuid4

from PIL import Image, ImageDraw, ImageFont
from telebot import types

from PANEL.settings import tg_client

BASE_FONT = 'static/fonts/Roboto-Regular.ttf'
BOLD_FONT = 'static/fonts/Roboto-Bold.ttf'

def create_image_yandex_tink(
        tg_id: str,
        phone: str,
        text_1: str,
        text_2: str,
        text_3: str,
        name: str = None
):
    # Открываем изображение
    image = Image.open("static/images/yandex/tink.jpg")
    draw = ImageDraw.Draw(image)
    width, height = image.size

    font = ImageFont.truetype(BASE_FONT, 28)
    bold_font = ImageFont.truetype(BASE_FONT, 44)
    black = (0, 0, 0)
    white = (255, 255, 255)

    # Первый текст — по центру изображения
    text_black = f'- {text_3} ₽'
    bbox = draw.textbbox((0, 0), text_black, font=bold_font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    pos_x = (width - text_width) // 2
    pos_y = 520  # или любое нужное значение
    pos_black = (pos_x, pos_y)
    draw.text(pos_black, text_black, fill=white, font=bold_font)

    # Второй текст — по центру относительно первого, чуть ниже
    second_text = f'{text_3} ₽ на {phone}'
    bbox2 = draw.textbbox((0, 0), second_text, font=font)
    second_width = bbox2[2] - bbox2[0]
    second_height = bbox2[3] - bbox2[1]

    second_x = pos_x + (text_width - second_width) // 2
    second_y = pos_y + text_height + 40  # немного ниже
    draw.text((second_x, second_y), second_text, fill=white, font=font)

    # Третий текст — по центру относительно первого, чуть ниже
    second_text = f'{name if name else ''} в Т-Банк (Тинькофф)'
    bbox2 = draw.textbbox((0, 0), second_text, font=font)
    second_width = bbox2[2] - bbox2[0]
    second_height = bbox2[3] - bbox2[1]

    second_x = pos_x + (text_width - second_width) // 2
    second_y = pos_y + text_height + 80 # немного ниже
    draw.text((second_x, second_y), second_text, fill=white, font=font)

    # Сохраняем изображение в буфер
    img_io = BytesIO()
    image.save(img_io, format='JPEG')
    img_io.seek(0)

    # Отправка в Telegram
    tg_client.send_photo(
        chat_id=tg_id,
        photo=img_io
    )
