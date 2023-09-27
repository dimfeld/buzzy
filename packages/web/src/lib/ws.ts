export enum MsgType {
  client_hello = 1,
  request_audio_chat = 2,
  request_text_chat = 3,
  new_chat_response = 4,
  chat_response_audio = 5,
  chat_response_text = 6,
}

export interface Message<TYPE extends MsgType, DATA> {
  type: TYPE;
  data: DATA;
}

export type ClientInitMsg = Message<MsgType.client_hello, { sample_rate: number }>;
export type RequestAudioMsg = Message<MsgType.request_audio_chat, { audio: ArrayBuffer }>;
export type RequestTextMsg = Message<MsgType.request_text_chat, { text: string }>;

export type NewChatResponseMsg = Message<MsgType.new_chat_response, { chat_id: number }>;
export type ChatResponseAudioMsg = Message<
  MsgType.chat_response_audio,
  { chat_id: number; audio: ArrayBuffer }
>;
export type ChatResponseTextMsg = Message<
  MsgType.chat_response_text,
  { chat_id: number; text: string }
>;

export type AnyMessage =
  | ClientInitMsg
  | RequestAudioMsg
  | RequestTextMsg
  | NewChatResponseMsg
  | ChatResponseAudioMsg
  | ChatResponseTextMsg;

function hasBinaryData(type: MsgType) {
  return type === MsgType.chat_response_audio || type === MsgType.request_audio_chat;
}

const CURRENT_VERSION = 0;
const HEADER_LENGTH = 8;

// Data format
// 0 - protocol version
// 1 - reserved for future flags
// 2-3 - message type
// 4-7 - text data length
// text data
// binary data, if present

function serializeData(msgType: MsgType, jsonData: object, binary?: ArrayBuffer) {
  let encoder = new TextEncoder();
  let textData = JSON.stringify(jsonData);

  let encodedText = encoder.encode(textData);

  let buffer = new ArrayBuffer(HEADER_LENGTH + textData.length + (binary?.byteLength ?? 0));

  let dataView = new DataView(buffer);
  dataView.setUint8(0, CURRENT_VERSION);
  dataView.setUint8(1, 0); // Reserved for future use
  dataView.setUint16(2, msgType, true);
  dataView.setUint32(4, encodedText.length, true);

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
  let textLength = headerView.getUint32(4, true);

  let byteView = new Uint8Array(data);

  let decoder = new TextDecoder();
  let decoded = JSON.parse(
    decoder.decode(byteView.subarray(HEADER_LENGTH, HEADER_LENGTH + textLength))
  );

  let binaryData = hasBinaryData(msgType)
    ? byteView.subarray(HEADER_LENGTH + textLength).slice()
    : undefined;
  return {
    type: msgType,
    data: decoded,
    binaryData,
  };
}

function serializeAudioData<DATA extends { audio: ArrayBuffer }>(
  msgType: MsgType,
  data: DATA
): ArrayBuffer {
  let { audio, ...rest } = data;
  return serializeData(msgType, rest, audio);
}

export function serializeMessage<MSG extends AnyMessage>(msg: MSG) {
  switch (msg.type) {
    case MsgType.chat_response_audio:
    case MsgType.request_audio_chat:
      return serializeAudioData(msg.type, msg.data);
    default:
      return serializeData(msg.type, msg.data);
  }
}

export function deserializeMessage(msg: ArrayBuffer): AnyMessage {
  let { type, data, binaryData } = deserializeData(msg);

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
    data,
  } as unknown as AnyMessage;
}
