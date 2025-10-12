from io import BytesIO
from uuid import uuid4

from PIL import Image, ImageDraw, ImageFont
from telebot import types

from PANEL.settings import tg_client

BASE_FONT = 'static/fonts/Roboto-Regular.ttf'
BOLD_FONT = 'static/fonts/Roboto-Bold.ttf'

def create_image_alpha(
        tg_id: str,
        phone: str,
        text_1: str,
        text_2: str,
        text_3: str,
        name: str = None
):
    # Открываем изображение
    image = Image.open("static/images/tink/alfa.jpg")
    draw = ImageDraw.Draw(image)
    width, height = image.size

    font_size = 28
    font = ImageFont.truetype(BASE_FONT, font_size)
    black = (0, 0, 0)
    white = (255, 255, 255)

    draw.text((230, 754), phone, fill=black, font=font)

    text_black = "Black"
    pos_black = (325, 320)
    draw.text(pos_black, text_black, fill=white, font=font)

    bbox_black = draw.textbbox(pos_black, text_black, font=font)
    center_x = (bbox_black[0] + bbox_black[2]) // 2

    arrow = " › "
    y_arrow = 370
    bbox_arrow = draw.textbbox((0, 0), arrow, font=font)
    arrow_width = bbox_arrow[2] - bbox_arrow[0]
    arrow_x = center_x - arrow_width // 2
    draw.text((arrow_x, y_arrow), arrow, fill=white, font=font)

    text3 = f"{text_1} ₽"
    text4 = f"{text_2} ₽"
    spacing = 10

    bbox3 = draw.textbbox((0, 0), text3, font=font)
    width3 = bbox3[2] - bbox3[0]

    bbox4 = draw.textbbox((0, 0), text4, font=font)
    width4 = bbox4[2] - bbox4[0]

    pos_text3 = (arrow_x - spacing - width3, y_arrow)
    pos_text4 = (arrow_x + arrow_width + spacing, y_arrow)

    draw.text(pos_text3, text3, fill=white, font=font)

    bbox3_real = draw.textbbox(pos_text3, text3, font=font)
    y_mid = (bbox3_real[1] + bbox3_real[3]) // 2
    draw.line((bbox3_real[0], y_mid, bbox3_real[2], y_mid), fill=white, width=2)

    draw.text(pos_text4, text4, fill=white, font=font)

    text5 = f"-{text_3} ₽"
    font_size5 = 50
    font5 = ImageFont.truetype(BOLD_FONT, font_size5)
    bbox5 = draw.textbbox((0, 0), text5, font=font5)
    width5 = bbox5[2] - bbox5[0]
    pos5_x = center_x - width5 // 2
    pos5_y = 430
    draw.text((pos5_x, pos5_y), text5, fill=white, font=font5)

    name = name if name else 'В Альфа-Банк'
    font_size6 = 28
    font6 = ImageFont.truetype(BASE_FONT, font_size6)
    bbox6 = draw.textbbox((0, 0), name, font=font6)
    width6 = bbox6[2] - bbox6[0]
    pos6_x = center_x - width6 // 2
    pos6_y = 544
    draw.text((pos6_x, pos6_y), name, fill=white, font=font6)

    # Сохраняем изображение в буфер
    img_io = BytesIO()
    image.save(img_io, format='JPEG')
    img_io.seek(0)

    # Отправка в Telegram
    tg_client.send_photo(
        chat_id=tg_id,
        photo=img_io
    )
