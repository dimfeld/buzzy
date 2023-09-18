from fastapi import FastAPI, Form, File
from typing import Annotated
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import torch
import numpy as np
import nemo.collections.asr.models as nemo_models

app = FastAPI()

whisper_model: WhisperForConditionalGeneration | None = None
whisper_processor: WhisperProcessor | None = None


def init_whisper():
    global whisper_model, whisper_processor
    if whisper_model is not None and whisper_processor is not None:
        return (whisper_model, whisper_processor)
    model_name = "openai/whisper-medium.en"
    whisper_processor = WhisperProcessor.from_pretrained(model_name)
    whisper_model = WhisperForConditionalGeneration.from_pretrained(model_name)
    whisper_model.config.forced_decoder_ids = whisper_processor.get_decoder_prompt_ids(
        language="english", task="transcribe"
    )

    return (whisper_model, whisper_processor)


def transcribe_whisper(data: bytes):
    (model, processor) = init_whisper()
    int_array = np.frombuffer(data, dtype=np.int16)
    input_features = processor(
        int_array, sampling_rate=16000, return_tensors="pt"
    ).input_features
    predicted_ids = model.generate(input_features)

    return processor.batch_decode(predicted_ids, skip_special_tokens=True)


asr_model: nemo_models.EncDecCTCModel | None = None


def init_fastconformer_ctc():
    global asr_model
    if asr_model is not None:
        return asr_model
    model = nemo_models.EncDecCTCModel.from_pretrained(
        model_name="nvidia/stt_en_fastconformer_ctc_large"
    )
    model.eval()
    model.encoder.freeze()
    model.decoder.freeze()

    asr_model = model
    return model


def transcribe_fastconformer_ctc(data: bytes):
    model = init_fastconformer_ctc()
    int_array = np.frombuffer(data, dtype=np.int16).astype(np.float32)

    input = torch.tensor(np.array([int_array]))
    input_len = torch.tensor(np.array([len(int_array)]))

    with torch.no_grad():
        logits, logits_len, greedy_predictions = model.forward(
            input_signal=input, input_signal_length=input_len
        )
        hypotheses, all_hyp = model.decoding.ctc_decoder_predictions_tensor(
            logits,
            decoder_lengths=logits_len,
            return_hypotheses=False,
        )
        return hypotheses


init_fastconformer_ctc()


@app.post("/transcribe")
async def transcribe(
    data: Annotated[bytes, File()], sample_rate=Annotated[int, Form()]
):
    transcription = transcribe_fastconformer_ctc(data)
    return {"result": transcription}
