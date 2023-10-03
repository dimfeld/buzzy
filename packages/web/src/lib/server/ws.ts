import {
  MsgType,
  deserializeMessage,
  sendMessage,
  type MessageWithId,
  type RequestAudioMsg,
  type RequestTextMsg,
} from '../ws';
import * as llm from '../llm/index';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { newAudioRenderer } from './tts';
import { runAsr } from './asr';

export function websocketSession(ws: WebSocket, _req: IncomingMessage) {
  console.log('opened websocket');
  ws.on('error', (err) => {
    console.error('websocket error', err);
  });

  ws.binaryType = 'arraybuffer';

  function handleMessage(message: MessageWithId) {
    console.log('got message', message);
    switch (message.type) {
      case MsgType.client_hello:
        break;
      case MsgType.request_audio_chat:
      case MsgType.request_text_chat:
        runChat(ws, message);
        break;
      default:
        sendError(`Server received unexpected message type ${message.type}`, message.id);
    }
  }

  function sendError(error: string, responseTo?: number) {
    sendMessage(ws, {
      type: MsgType.error,
      data: {
        response_to: responseTo,
        error,
      },
    });
  }

  ws.on('message', (data: ArrayBuffer) => {
    const value = deserializeMessage(data);
    try {
      handleMessage(value);
    } catch (e) {
      console.error(e);
      sendError((e as Error).message, value.id);
    }
  });

  ws.on('close', (code, reason) => {
    console.error('websocket closed', code, reason.toString());
  });
}

let nextChatId = 0;

async function runChat(
  ws: WebSocket,
  message: (RequestAudioMsg | RequestTextMsg) & { id: number }
) {
  let chatId = nextChatId++;

  sendMessage(ws, {
    type: MsgType.new_chat_response,
    data: {
      chat_id: chatId,
      response_to: message.id,
    },
  });

  let messageText: string;
  if (message.type === MsgType.request_audio_chat) {
    messageText = await runAsr(message.data.audio, message.data.sample_rate);
  } else {
    messageText = message.data.text;
  }

  // Send the parsed text back to the user
  sendMessage(ws, {
    type: MsgType.chat_response_text,
    data: {
      role: 'user',
      chat_id: chatId,
      text: messageText,
    },
  });

  const audioRenderer = newAudioRenderer();
  const ttsInput = audioRenderer.writable.getWriter();

  // TODO Move all this over to chunked data:
  // Send text to user as it gets returned from the LLM
  // Once we accumulate a sentence, render it into audio and send that to the client.

  let response = '';

  async function handleChunk(chunk: string) {
    sendMessage(ws, {
      type: MsgType.chat_response_text,
      data: {
        role: 'assistant',
        chat_id: chatId,
        text: chunk,
      },
    });

    response += chunk;

    let { sentences, rest } = llm.getSentences(response);

    response = rest;

    for (let sentence of sentences) {
      await ttsInput.write(sentence.trim());
    }
  }

  async function doText() {
    await llm.handleMessage(messageText, handleChunk);

    const remaining = response.trim();
    if (remaining) {
      await ttsInput.write(remaining);
    }

    await ttsInput.close();
  }

  async function doAudio() {
    for await (const audio of audioRenderer.readable) {
      sendMessage(ws, {
        type: MsgType.chat_response_audio,
        data: {
          chat_id: chatId,
          audio,
        },
      });
    }
  }

  await Promise.all([doText(), doAudio()]);

  sendMessage(ws, {
    type: MsgType.chat_response_done,
    data: {
      chat_id: chatId,
    },
  });
}
