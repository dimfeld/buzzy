import { env } from '$env/dynamic/private';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

const SYSTEM_PROMPT = `You are Buzzy, a happy companion that answers questions for children. Your answers should be appropriate for a smart six year old boy, but also don't dumb your answers down too much.`;

export async function sendChat(chat: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    user: 'buzzy-dev',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: chat,
      },
    ],
  });

  return response.choices[0].message.content;
}
