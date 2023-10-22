import { env } from '$env/dynamic/private';
import { desc, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db, chats, messages } from '../server/db';
import { openAIFunctionList, runLlmFunction } from './functions';
import type { ChatCompletionMessage, ChatCompletionMessageParam } from 'openai/resources/chat';

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

function testResponse() {
  const input = `Both the Doberman and the Golden Retriever are medium to large-sized dogs, but the Doberman tends to be a bit bigger. On average, a fully grown male Doberman can weigh around 65 to 90 pounds (30 to 40 kilograms) and stand about 26 to 28 inches (66 to 71 centimeters) tall at the shoulder. A male Golden Retriever, on the other hand, usually weighs around 65 to 75 pounds (30 to 34 kilograms) and stands about 23 to 24 inches (58 to 61 centimeters) tall. So, the Doberman is generally bigger than the Golden Retriever, but it's important to remember that individual dogs can vary in size even within the same breed.`;
  // const input = `Both the Doberman and the Golden Retriever are medium to large-sized dogs`;

  return new ReadableStream({
    async start(controller) {
      let i = 0;
      while (i < input.length) {
        const chunkSize = 2 + Math.ceil(Math.random() * 10);
        const chunk = input.substring(i, i + chunkSize);
        i += chunkSize;

        // Emulate OpenAI response
        controller.enqueue({
          choices: [
            {
              delta: {
                content: chunk,
              },
            },
          ],
        });
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));
      }
      controller.close();
    },
  });
}

interface SendChatOptions {
  chatId: number;
  chat: string;
  messages?: ChatCompletionMessageParam[];
  saveResults?: boolean;
  allowFunctions?: boolean;
  cb: (chunk: string) => void;
}

async function sendChat(options: SendChatOptions) {
  let chatMessages = options.messages;
  if (!chatMessages) {
    const latestMessages = await getChatContext(options.chatId);

    chatMessages = [
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
        content: options.chat,
      },
    ];
  }

  const sendTime = new Date();

  const TEST = false;
  const response = TEST
    ? testResponse()
    : await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        user: 'buzzy-dev',
        stream: true,
        function_call: options.allowFunctions === false ? 'none' : 'auto',
        functions: openAIFunctionList,
        messages: chatMessages,
      });

  let message = '';
  for await (const chunk of response) {
    const delta: ChatCompletionMessage = chunk.choices[0]?.delta;
    if (!delta) {
      continue;
    }

    if (delta.function_call) {
      let fnStartTime = Date.now();
      let duration = fnStartTime - sendTime.valueOf();
      console.log(`Duration to get function: ${duration}ms`);

      const fnResponse = await runLlmFunction(delta.function_call);

      duration = Date.now() - fnStartTime.valueOf();
      console.log(`Duration to run function: ${duration}ms`);

      if (fnResponse) {
        if (fnResponse.replay) {
          chatMessages.push(delta);
          chatMessages.push({
            role: 'function',
            name: delta.function_call.name,
            content: fnResponse.text,
          });

          return sendChat({
            ...options,
            allowFunctions: false,
            messages: chatMessages,
          });
        } else {
          options.cb(fnResponse.text);
          message += fnResponse.text;
          break;
        }
      }
    }

    const text = delta.content;
    if (!text) {
      continue;
    }

    options.cb(text);
    message += text;
  }

  const duration = Date.now() - sendTime.valueOf();
  console.log(`Duration: ${duration}ms`);

  if (!message) {
    return '';
  }

  if (options.saveResults && !TEST) {
    await db.insert(messages).values([
      {
        chat_id: options.chatId,
        role: 'user',
        content: options.chat,
        timestamp: sendTime,
      },
      {
        chat_id: options.chatId,
        role: 'assistant',
        content: message,
        timestamp: new Date(),
      },
    ]);
  }

  return message;
}

export async function handleMessage(
  chat: string,
  saveResults: boolean,
  cb: (chunk: string) => void
) {
  if (!chat) {
    return '';
  }

  const chatId = await getOrCreateChat();
  const response = await sendChat({ chatId, chat, saveResults, cb });

  return response;
}

export function getSentences(input: string) {
  let last = 0;
  let boundary = /[.!?](?: |$)/g;
  let sentences = [];
  while (boundary.test(input)) {
    // Check for capital letters, which would indicate the start of a sentence as opposed to the end of an acronym
    // within a sentence. This isn't perfect but works ok for a first pass.
    const i = boundary.lastIndex;
    if (/[A-Z0-9]/.test(input[i])) {
      sentences.push(input.substring(last, i).trim());
      last = i;
    }
  }

  return {
    sentences,
    rest: input.substring(last),
  };
}
