from app.setting.models import PromptModel


def get_prompt(
        code: str,
):
    """
    Получит промпт
    """
    prompt = PromptModel.objects.get_or_none(code=code)
    print(prompt)