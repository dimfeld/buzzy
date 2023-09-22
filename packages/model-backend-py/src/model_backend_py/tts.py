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
