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
import type { Duplex } from 'stream';
import { getWebsocketServer } from './ws_node';

function sendError(ws: WebSocket, error: string, responseTo?: number) {
  sendMessage(ws, {
    type: MsgType.error,
    data: {
      response_to: responseTo,
      error,
    },
  });
}

export function handleUpgrade(req: IncomingMessage, sock: Duplex, head: Buffer) {
  const wsServer = getWebsocketServer();
  wsServer.handleUpgrade(req, sock, head, (ws) => {
    console.log('handled', req.url);
    websocketSession(ws, req);
  });
}

export function websocketSession(ws: WebSocket, _req: IncomingMessage) {
  console.log('opened websocket');
  ws.on('error', (err) => {
    console.error('websocket error', err);
  });

  ws.binaryType = 'arraybuffer';

  function handleMessage(message: MessageWithId) {
    switch (message.type) {
      case MsgType.client_hello:
        break;
      case MsgType.request_audio_chat:
      case MsgType.request_text_chat:
        return runChat(ws, message);
      default:
        sendError(ws, `Server received unexpected message type ${message.type}`, message.id);
    }
  }

  ws.on('message', async (data: ArrayBuffer) => {
    const value = deserializeMessage(data);
    try {
      await handleMessage(value);
    } catch (e) {
      console.error(e);
      sendError(ws, (e as Error).message, value.id);
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
  let tts = message.data.tts;

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

  const audioRenderer = tts ? newAudioRenderer() : null;
  const ttsInput = audioRenderer?.writable.getWriter();

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

    if (ttsInput) {
      response += chunk;

      let { sentences, rest } = llm.getSentences(response);

      response = rest;

      for (let sentence of sentences) {
        await ttsInput.write(sentence.trim());
      }
    }
  }

  async function doText() {
    await llm.handleMessage(messageText, handleChunk);

    const remaining = response.trim();
    if (ttsInput) {
      if (remaining) {
        await ttsInput.write(remaining);
      }

      await ttsInput.close();
    }
  }

  async function doAudio() {
    if (!audioRenderer) {
      return;
    }

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
