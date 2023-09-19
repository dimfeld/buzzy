import { handleMessage } from '$lib/llm';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  const form = await request.formData();
  const chat = form.get('text') as string;

  const response = await handleMessage(chat);
  return json({
    response,
  });
}
