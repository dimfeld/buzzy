import { sendChat } from '$lib/llm/index.js';

export const actions = {
  default: async ({ request, locals: { ky } }) => {
    let form = await request.formData();
    let chat = form.get('chat') as string;
    if (!chat) {
      return {
        response: '',
      };
    }

    const response = await sendChat(chat);
    return {
      response,
    };
  },
};
