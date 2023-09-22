from transformers import pipeline

classifier = pipeline(
    "zero-shot-classification", model="MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
)


def get_intent(text: str, labels: list[str]):
    return classifier(text, labels)
