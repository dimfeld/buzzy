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
import { generateAudio } from './tts';
import { runAsr } from './asr';

export function websocketSession(ws: WebSocket, _req: IncomingMessage) {
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

  // TODO Move all this over to chunked data:
  // Send text to user as it gets returned from the LLM
  // Once we accumulate a sentence, render it into audio and send that to the client.

  const TEST = true;
  const response = TEST ? 'a simple response' : await llm.handleMessage(messageText);

  sendMessage(ws, {
    type: MsgType.chat_response_text,
    data: {
      role: 'assistant',
      chat_id: chatId,
      text: response,
    },
  });

  // Generate audio
  const audio = await generateAudio(response);

  sendMessage(ws, {
    type: MsgType.chat_response_audio,
    data: {
      chat_id: chatId,
      audio,
    },
  });

  sendMessage(ws, {
    type: MsgType.chat_response_done,
    data: {
      chat_id: chatId,
    },
  });
}
