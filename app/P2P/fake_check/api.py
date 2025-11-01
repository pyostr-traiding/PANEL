import random
from typing import Optional

from django.http import HttpRequest

from ninja import Router
from pydantic import BaseModel

from app.P2P.service.ozon.alfa import create_image_ozon_alpha
from app.P2P.service.ozon.otp import create_image_ozon_otp
from app.P2P.service.ozon.ozon import create_image_ozon_ozon
from app.P2P.service.ozon.sber import create_image_ozon_sber
from app.P2P.service.ozon.tink import create_image_ozon_tink
from app.P2P.service.tink.alfa import create_image_alpha
from app.P2P.service.tink.ozon import create_image_ozon
from app.P2P.service.tink.raif import create_image_raif
from app.P2P.service.tink.sber import create_image_sber
from app.P2P.service.tink.tink import create_image_tink
from app.P2P.service.yandex.alfa import create_image_yandex_alpha
from app.P2P.service.yandex.raif import create_image_yandex_raif
from app.P2P.service.yandex.sber import create_image_yandex_sber
from app.P2P.service.yandex.tink import create_image_yandex_tink

router = Router(
    tags=['Wallet чеки'],
)

class ReceiptSchema(BaseModel):
    from_bank: str = 'Яндекс'
    bank: str = 'Сбер'

    tg_id: str = '572982939'
    phone: str = '+7 (999) 888-12-34'
    name: Optional[str] = 'Наебалов У.'
    text_1: str = '300 000'

def get_random_number():
    return random.randint(1000, 100000)

def format_number_with_spaces(number):
    number = float(str(number).replace(" ", "").replace(",", "."))
    if number.is_integer():
        return f"{int(number):,}".replace(",", " ")
    else:
        return f"{number:,.2f}".replace(",", " ").replace(".", ",")


@router.post('/')
def send_fake_receipt(
        request: HttpRequest,
        data: ReceiptSchema,

):
    """
    Создать чек
    """
    text_2 = get_random_number()
    text_1 = str(float(data.text_1.replace(' ', '').replace(',', '.')) + text_2)
    text_3 = float(data.text_1.replace(' ', '').replace(',', '.'))

    if data.from_bank == 'Тинк':
        if data.bank == 'Сбер':
            create_image_sber(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'Альфа':
            create_image_alpha(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return
        if data.bank == 'Райф':
            create_image_raif(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return


        if data.bank == 'Тинк':
            create_image_tink(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return
        if data.bank == 'Озон':
            create_image_ozon(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return
    if data.from_bank == 'Яндекс':
        if data.bank == 'Сбер':
            create_image_yandex_sber(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'Альфа':
            create_image_yandex_alpha(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return
        if data.bank == 'Райф':
            create_image_yandex_raif(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'Тинк':
            create_image_yandex_tink(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

    if data.from_bank == 'Озон':
        if data.bank == 'Сбер':
            create_image_ozon_sber(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'Альфа':
            create_image_ozon_alpha(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'Тинк':
            create_image_ozon_tink(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'Озон':
            create_image_ozon_ozon(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return

        if data.bank == 'ОТП':
            create_image_ozon_otp(
                tg_id=data.tg_id,
                phone=data.phone,
                name=data.name,
                text_1=format_number_with_spaces(text_1),
                text_2=format_number_with_spaces(text_2),
                text_3=format_number_with_spaces(text_3),
            )
            return