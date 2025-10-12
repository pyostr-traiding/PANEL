from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

from PANEL.settings import tg_client

BASE_FONT = 'static/fonts/Roboto-Regular.ttf'
BOLD_FONT = 'static/fonts/Roboto-Bold.ttf'


def create_image_ozon_otp(
        tg_id: str,
        phone: str,
        text_1: str,
        text_2: str,
        text_3: str,
        name: str = None
):
    image = Image.open("static/images/ozon/otp.jpg")
    draw = ImageDraw.Draw(image)

    font_size = 37
    font = ImageFont.truetype(BASE_FONT, font_size)
    white = (255, 255, 255)

    # =========================
    # 1. Статичный блок (точка центровки)
    # =========================
    block_center_x = 335  # фиксированная X-позиция центра блока (можно менять)

    # Можно нарисовать точку для визуализации (не обязательно)
    # draw.ellipse((block_center_x-5, 545, block_center_x+5, 555), fill=(255,0,0))

    # =========================
    # 2. text_3 - выравниваем по центру блока
    # =========================
    font_text3 = ImageFont.truetype(BOLD_FONT, font_size + 5)  # на 5 больше для text_3
    text3_bbox = draw.textbbox((0, 0), f"- {text_3} ₽", font=font_text3)
    text3_width = text3_bbox[2] - text3_bbox[0]
    text3_pos_x = block_center_x - text3_width // 2
    text3_pos_y = 550
    draw.text((text3_pos_x, text3_pos_y), f"- {text_3}₽", fill=white, font=font_text3)

    # =========================
    # 3. phone - выравниваем по центру блока
    # =========================
    phone_bbox = draw.textbbox((0, 0), phone, font=font)
    phone_width = phone_bbox[2] - phone_bbox[0]
    phone_pos_x = block_center_x - phone_width // 2
    phone_pos_y = 754
    draw.text((phone_pos_x, phone_pos_y), phone, fill=white, font=font)

    # =========================
    # 4. name - выравниваем по центру блока
    # =========================
    name = 'ОТП Банк'
    name_bbox = draw.textbbox((0, 0), name, font=font)
    name_width = name_bbox[2] - name_bbox[0]
    name_pos_x = block_center_x - name_width // 2
    name_pos_y = 672
    draw.text((name_pos_x, name_pos_y), name, fill=white, font=font)

    # =========================
    # Сохраняем результат
    # =========================

    img_io = BytesIO()
    image.save(img_io, format='JPEG')
    img_io.seek(0)

    # Отправка в Telegram
    tg_client.send_photo(
        chat_id=tg_id,
        photo=img_io
    )
