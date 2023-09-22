from fastapi import FastAPI, Form, File, Response
from typing import Annotated

from asr import init_fastconformer_ctc, transcribe_fastconformer_ctc
from tts import init_vits_tts, do_vits_tts
from intent import get_intent

app = FastAPI()
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


@app.post("/intent")
async def intent(text: Annotated[str, Form()], labels: Annotated[list[str], Form()]):
    return {"result": get_intent(text, labels)}
