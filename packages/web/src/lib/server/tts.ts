import { env } from '$env/dynamic/private';
import ky from 'ky';

const mimicUrl = `http://${env.MIMIC_HOST}:${env.MIMIC_PORT || 8573}`;

export async function generateAudio(text: string): Promise<ArrayBuffer> {
  const qs = new URLSearchParams({
    voice: `${env.MIMIC_VOICE}#${env.MIMIC_SPEAKER}`,
    lengthScale: '1.2',
    voiceScale: '0.333',
    voiceW: '0.333',
  });

  let response = await ky(`${mimicUrl}/api/tts?${qs.toString()}`, {
    body: text,
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
  }).arrayBuffer();

  return response;
}

export function newAudioRenderer() {
  const stream = new TransformStream<string, ArrayBuffer>({
    transform(chunk, controller) {
      return generateAudio(chunk)
        .then((response) => controller.enqueue(response))
        .catch((e) => controller.error(e));
    },
  });

  return stream;
}
