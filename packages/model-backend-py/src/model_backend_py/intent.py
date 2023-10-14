from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch

device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")

# model = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
model_name = "MoritzLaurer/deberta-v3-large-zeroshot-v1"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

classifier = pipeline("zero-shot-classification", model=model, tokenizer=tokenizer)


def get_intent(text: str, intents: list[str]):
    return classifier(text, intents)


def entailment(premise: str, hypothesis: str):
    input = tokenizer(premise, hypothesis, truncation=True, return_tensors="pt")
    output = model(input["input_ids"].to(device))  # device = "cuda:0" or "cpu"
    prediction = torch.softmax(output["logits"][0], -1).tolist()
    true_score = float(prediction[0])
    false_score = float(prediction[1])

    return {"result": true_score > false_score, "score": true_score}
