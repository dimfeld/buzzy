import { env } from '$env/dynamic/private';
import ky from 'ky';

const fastApiUrl = `http://127.0.0.1:${env.FASTAPI_PORT || 8000}`;

export async function runAsr(audio: ArrayBuffer, sampleRate: number) {
  let formData = new FormData();
  formData.append('data', new File([audio], 'audio.bin'));
  formData.append('sample_rate', sampleRate.toString());

  let response = await ky(`${fastApiUrl}/transcribe`, {
    body: formData,
    method: 'POST',
  }).json<{ result: string }>();

  return response.result;
}
