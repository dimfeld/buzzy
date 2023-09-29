import { getChatContext, getOrCreateChat, handleMessage, sendChat } from '$lib/llm/index.js';

export async function load() {
  const chatId = await getOrCreateChat();
  const messages = await getChatContext(chatId);

  return {
    messages: messages.map((m) => ({
      role: m.role as 'assistant' | 'user',
      content: m.content,
      wsId: -1,
    })),
  };
}

export const actions = {
  default: async ({ request }) => {
    let form = await request.formData();
    let chat = form.get('chat') as string;
    const response = await handleMessage(chat);
    return {
      response,
    };
  },
};
