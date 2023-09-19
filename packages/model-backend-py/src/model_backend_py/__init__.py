from fastapi import FastAPI, Form, File, Response
from typing import Annotated
from transformers import (
    BarkProcessor,
    VitsModel,
    VitsPreTrainedModel,
    VitsTokenizer,
    WhisperProcessor,
    WhisperForConditionalGeneration,
    BarkModel,
)
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


bark_tts_model: BarkModel | None = None
bark_tts_processor: BarkProcessor | None = None


def init_bark_tts():
    global bark_tts_model, bark_tts_processor
    if bark_tts_model is not None and bark_tts_processor is not None:
        return (bark_tts_model, bark_tts_processor)
    model_name = "suno/bark-small"
    processor = BarkProcessor.from_pretrained(model_name)
    model = BarkModel.from_pretrained(model_name)
    bark_tts_processor = processor
    bark_tts_model = model
    return (model, processor)


def do_bark_tts(text: str):
    model, processor = init_bark_tts()
    voice_preset = "v2/en_speaker_2"
    inputs = processor(text, voice_preset=voice_preset)
    audio_array = model.generate(**inputs)
    buf: np.ndarray = audio_array.cpu().numpy().squeeze()
    return buf.astype(np.float32)


vits_tts_model: VitsPreTrainedModel | None = None
vits_tts_tokenizer: VitsTokenizer | None = None


def init_vits_tts():
    global vits_tts_model, vits_tts_tokenizer
    if vits_tts_model is not None and vits_tts_tokenizer is not None:
        return (vits_tts_model, vits_tts_tokenizer)
    model_name = "facebook/mms-tts-eng"
    tokenizer = VitsTokenizer.from_pretrained(model_name)
    model = VitsModel.from_pretrained(model_name)
    vits_tts_tokenizer = tokenizer
    vits_tts_model = model
    return (model, tokenizer)


def do_vits_tts(text: str):
    model, tokenizer = init_vits_tts()
    inputs = tokenizer(text, return_tensors="pt")
    with torch.no_grad():
        output = model(**inputs).waveform
    array: np.ndarray = output.float().numpy()
    return array.tobytes()


init_fastconformer_ctc()
# init_bark_tts()


@app.post("/transcribe")
async def transcribe(
    data: Annotated[bytes, File()], sample_rate=Annotated[int, Form()]
):
    transcription = transcribe_fastconformer_ctc(data)
    return {"result": transcription}


@app.get("/tts_config")
def tts_config():
    model, processor = init_vits_tts()
    return {"sample_rate": model.config.sampling_rate}


@app.post("/tts")
async def tts(text: Annotated[str, Form()]):
    result = do_vits_tts(text)
    return Response(content=result, media_type="application/octet-stream")
