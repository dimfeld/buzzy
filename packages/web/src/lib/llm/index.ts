import { OPENAI_KEY } from '$env/dynamic/private';

export async function sendChat(chat: string) {
  return `a response to ${chat}`;
}
