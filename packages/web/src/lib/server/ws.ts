import {
  MsgType,
  deserializeMessage,
  sendMessage,
  type MessageWithId,
  type RequestAudioMsg,
  type RequestTextMsg,
} from '$lib/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';

export function websocketSession(ws: WebSocket, _req: IncomingMessage) {
  let incomingAudioSampleRate = 16000;

  ws.binaryType = 'arraybuffer';

  function handleMessage(message: MessageWithId) {
    switch (message.type) {
      case MsgType.client_hello:
        incomingAudioSampleRate = message.data.sample_rate;
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
    handleMessage(value);
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
    messageText = await runAsr(message.data.audio);

    // Send the parsed text back to the user
    sendMessage(ws, {
      type: MsgType.chat_response_text,
      data: {
        role: 'user',
        chat_id: chatId,
        text: messageText,
      },
    });
  } else {
    messageText = message.data.text;
  }

  // Send to ChatGPT
  // Generate audio and send to user as each sentence is streamed back.
}

async function runAsr(audio: ArrayBuffer) {
  return 'TODO';
}

async function generateAudio(text: string) {
  // TODO
}
