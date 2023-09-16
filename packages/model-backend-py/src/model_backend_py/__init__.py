from fastapi import FastAPI, Form, File
from typing import Annotated
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import numpy as np

app = FastAPI()

model_name = "openai/whisper-medium.en"
processor = WhisperProcessor.from_pretrained(model_name)
model: WhisperForConditionalGeneration = (
    WhisperForConditionalGeneration.from_pretrained(model_name)
)
model.config.forced_decoder_ids = processor.get_decoder_prompt_ids(
    language="english", task="transcribe"
)


@app.post("/transcribe")
async def transcribe(
    data: Annotated[bytes, File()], sample_rate=Annotated[int, Form()]
):
    int_array = np.frombuffer(data, dtype=np.int16)
    input_features = processor(
        int_array, sampling_rate=16000, return_tensors="pt"
    ).input_features
    predicted_ids = model.generate(input_features)

    transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)
    return {"result": transcription}
