import { env } from '$env/dynamic/private';
import { desc, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db, chats, messages } from '../server/db';

const openai = new OpenAI({
  apiKey: env.OPENAI_KEY,
});

const SYSTEM_PROMPT = `You are Buzzy, a happy companion that answers questions for children. Your answers should be appropriate for a smart six year old boy, but also don't dumb your answers down too much.`;

type Role = 'user' | 'assistant';

export async function getChatContext(chatId: number) {
  // Right now we simply get the last 6 messages and use that for the chat context.
  const latestMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chat_id, chatId))
    .orderBy(desc(messages.timestamp))
    .limit(6);

  latestMessages.reverse();

  return latestMessages;
}

/** Create a new chat. Currently this just ensures that a single chat exists and always reuses that one. */
export async function getOrCreateChat() {
  await db
    .insert(chats)
    .values({
      id: 1,
      title: '',
    })
    .onConflictDoNothing();

  return 1;
}

export async function sendChat(chatId: number, chat: string) {
  const latestMessages = await getChatContext(chatId);

  const sendTime = new Date();

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    user: 'buzzy-dev',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      ...latestMessages.map((m) => ({
        role: m.role as Role,
        content: m.content,
      })),
      {
        role: 'user',
        content: chat,
      },
    ],
  });

  const message = response.choices[0].message.content;
  if (!message) {
    return '';
  }

  await db.insert(messages).values([
    {
      chat_id: chatId,
      role: 'user',
      content: chat,
      timestamp: sendTime,
    },
    {
      chat_id: chatId,
      role: 'assistant',
      content: message,
      timestamp: new Date(),
    },
  ]);

  return message;
}
