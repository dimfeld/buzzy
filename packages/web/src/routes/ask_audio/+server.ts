import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

const fastApiUrl = `http://127.0.0.1:${env.FASTAPI_PORT || 8000}`;

export async function POST({ request, fetch }) {
  let body = request.body;
  const contentType = request.headers.get('Content-Type');
  if (!contentType) {
    throw error(400, 'No Content-Type provided');
  }

  let req = new Request(`${fastApiUrl}/transcribe`, {
    body,
    method: 'POST',
    duplex: 'half',
    headers: {
      'Content-Type': contentType,
    },
  });

  return fetch(req);
}
