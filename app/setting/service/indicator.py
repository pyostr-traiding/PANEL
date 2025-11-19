from typing import Union, List

from django.forms import model_to_dict

from app.setting.models import ExchangeModel, IndicatorSettingsModel
from app.setting.schemas.indicator import IndicatorSchema
from app.utils import response


def get_indicator(
        name: str,
) -> Union[IndicatorSchema, response.BaseResponse]:
    indicator = IndicatorSettingsModel.objects.get_or_none(name=name)
    if not indicator:
        return response.NotFoundResponse(
            msg='Индикатора не найдено'
        )
    data = model_to_dict(indicator)
    return IndicatorSchema.model_validate(data)

def get_indicator_list(
) -> Union[List[IndicatorSchema], response.BaseResponse]:
    indicators = IndicatorSettingsModel.objects.all()
    if not indicators:
        return response.NotFoundResponse(
            msg='Индикатора не найдено'
        )
    return [IndicatorSchema.model_validate(model_to_dict(i)) for i in indicators]


def update_indicator(
        data: IndicatorSchema,
) -> Union[IndicatorSchema, response.BaseResponse]:
    indicator = IndicatorSettingsModel.objects.get_or_none(name=data.name)
    if not indicator:
        return response.NotFoundResponse(
            msg='Индикатора не найдено'
        )
    indicator.json = data.json
    indicator.save()
    data = model_to_dict(indicator)
    return IndicatorSchema.model_validate(data)