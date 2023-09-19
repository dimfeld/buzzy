import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

const mimicUrl = `http://${env.MIMIC_HOST}:${env.MIMIC_PORT || 8573}`;

export async function POST({ request, fetch }) {
  let form = await request.formData();
  let text = form.get('text');
  if (!text) {
    throw error(400, "Missing 'text'");
  }

  const qs = new URLSearchParams({
    voice: `${env.MIMIC_VOICE}#${env.MIMIC_SPEAKER}`,
    lengthScale: '1.2',
    voiceScale: '0.333',
    voiceW: '0.333',
  });

  let req = new Request(`${mimicUrl}/api/tts?${qs.toString()}`, {
    body: text,
    method: 'POST',
    duplex: 'half',
    headers: {
      'Content-Type': 'text/plain',
    },
  });

  return fetch(req);
}
