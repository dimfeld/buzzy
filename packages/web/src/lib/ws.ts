export enum MsgType {
  client_hello = 1,
  error = 2,
  request_audio_chat = 3,
  request_text_chat = 4,
  new_chat_response = 5,
  chat_response_audio = 6,
  chat_response_text = 7,
  chat_response_done = 8,
}

export interface Message<TYPE extends MsgType, DATA> {
  type: TYPE;
  data: DATA;
}

export type ClientInitMsg = Message<MsgType.client_hello, {}>;
export type ErrorMsg = Message<MsgType.error, { error: string; response_to?: number }>;
export type RequestAudioMsg = Message<
  MsgType.request_audio_chat,
  { audio: ArrayBuffer; sample_rate: number }
>;
export type RequestTextMsg = Message<MsgType.request_text_chat, { text: string }>;

export type NewChatResponseMsg = Message<
  MsgType.new_chat_response,
  { chat_id: number; response_to: number }
>;
export type ChatResponseAudioMsg = Message<
  MsgType.chat_response_audio,
  { chat_id: number; audio: ArrayBuffer }
>;
export type ChatResponseTextMsg = Message<
  MsgType.chat_response_text,
  { chat_id: number; role: 'user' | 'assistant'; text: string }
>;
export type ChatResponseDoneMsg = Message<MsgType.chat_response_done, { chat_id: number }>;

export type AnyMessage =
  | ClientInitMsg
  | ErrorMsg
  | RequestAudioMsg
  | RequestTextMsg
  | NewChatResponseMsg
  | ChatResponseAudioMsg
  | ChatResponseTextMsg
  | ChatResponseDoneMsg;

export type MessageWithId = AnyMessage & { id: number };

function hasBinaryData(type: MsgType) {
  return type === MsgType.chat_response_audio || type === MsgType.request_audio_chat;
}

const CURRENT_VERSION = 0;
const HEADER_LENGTH = 12;

// Data format
// 0 - protocol version
// 1 - reserved for future flags
// 2-3 - message type
// 4-7 - message ID
// 8-11 - text data length
// text data
// binary data, if present

function serializeData(msgType: MsgType, id: number, jsonData: object, binary?: ArrayBuffer) {
  let encoder = new TextEncoder();
  let textData = JSON.stringify(jsonData);

  let encodedText = encoder.encode(textData);

  let buffer = new ArrayBuffer(HEADER_LENGTH + textData.length + (binary?.byteLength ?? 0));

  let dataView = new DataView(buffer);
  dataView.setUint8(0, CURRENT_VERSION);
  dataView.setUint8(1, 0); // Reserved for future use
  dataView.setUint16(2, msgType, true);
  dataView.setUint32(4, id, true);
  dataView.setUint32(8, encodedText.length, true);

  let byteView = new Uint8Array(buffer);
  byteView.set(encodedText, HEADER_LENGTH);

  if (binary) {
    if (!hasBinaryData(msgType)) {
      throw new Error(`Binary data not allowed for message type ${msgType}`);
    }

    let audioBytes = new Uint8Array(binary);
    byteView.set(audioBytes, HEADER_LENGTH + encodedText.byteLength);
  }

  return buffer;
}

interface DeserializedMessage {
  type: MsgType;
  id: number;
  data: object;
  binaryData?: ArrayBuffer;
}

function deserializeData(data: ArrayBuffer): DeserializedMessage {
  let headerView = new DataView(data);
  let version = headerView.getUint8(0);
  // byte index 1 is reserved and not used yet

  if (version > CURRENT_VERSION) {
    throw new Error(`Unexpected version ${version}`);
  }
  let msgType = headerView.getUint16(2, true);
  let msgId = headerView.getUint32(4, true);
  let textLength = headerView.getUint32(8, true);

  let byteView = new Uint8Array(data);

  let decoder = new TextDecoder();
  let decoded = JSON.parse(
    decoder.decode(byteView.subarray(HEADER_LENGTH, HEADER_LENGTH + textLength))
  );

  let binaryData = hasBinaryData(msgType)
    ? byteView.subarray(HEADER_LENGTH + textLength).slice().buffer
    : undefined;
  return {
    type: msgType,
    id: msgId,
    data: decoded,
    binaryData,
  };
}

function serializeAudioData<DATA extends { audio: ArrayBuffer }>(
  msgType: MsgType,
  id: number,
  data: DATA
): ArrayBuffer {
  let { audio, ...rest } = data;
  return serializeData(msgType, id, rest, audio);
}

let nextId = 0;
function getMessageId() {
  let id = nextId++;
  if (nextId > 0xffffffff) {
    // Just wrap around at 32 bits. This theoretically could be an issue if 4 billion messages go by
    // and we're still keeping references to those old messages, but this particular system does not
    // use the message IDs long term.
    nextId = 0;
  }

  return id;
}

export function serializeMessage<MSG extends AnyMessage>(
  msg: MSG
): { id: number; data: ArrayBuffer } {
  let id = getMessageId();

  switch (msg.type) {
    case MsgType.chat_response_audio:
    case MsgType.request_audio_chat:
      return { id, data: serializeAudioData(msg.type, id, msg.data) };
    default:
      return { id, data: serializeData(msg.type, id, msg.data) };
  }
}

export function sendMessage<MSG extends AnyMessage>(
  ws: { send(data: ArrayBuffer): void } | null,
  message: MSG
): number {
  if (!ws) {
    // This only happens when the page and socket have closed so we don't want to send any more messages.
    return -1;
  }

  let { id, data } = serializeMessage<MSG>(message);
  ws.send(data);
  return id;
}

export function deserializeMessage(msg: ArrayBuffer): MessageWithId {
  let { type, id, data, binaryData } = deserializeData(msg);

  switch (type) {
    case MsgType.chat_response_audio:
    case MsgType.request_audio_chat:
      data = {
        ...data,
        audio: binaryData,
      };
  }

  return {
    type,
    id,
    data,
  } as unknown as MessageWithId;
}
