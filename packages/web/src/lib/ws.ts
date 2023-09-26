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

export type ClientToServerMsg = ClientInitMsg | RequestAudioMsg | RequestTextMsg;

export type NewChatResponseMsg = Message<MsgType.new_chat_response, { chat_id: number }>;
export type ChatResponseAudioMsg = Message<
  MsgType.chat_response_audio,
  { chat_id: number; audio: ArrayBuffer }
>;
export type ChatResponseTextMsg = Message<
  MsgType.chat_response_text,
  { chat_id: number; text: string }
>;

enum MessageFormat {
  text = 1,
  text_and_binary = 2,
}

const HEADER_LENGTH = 8;

function serializeData(msgType: MsgType, jsonData: object, binary?: ArrayBuffer) {
  const format = binary ? MessageFormat.text_and_binary : MessageFormat.text;
  let encoder = new TextEncoder();
  let textData = JSON.stringify(jsonData);

  let encodedText = encoder.encode(textData);

  let buffer = new ArrayBuffer(HEADER_LENGTH + textData.length + (binary?.byteLength ?? 0));
  let headerView = new Uint32Array(buffer);

  headerView[0] = format;
  headerView[1] = textData.length;

  let byteView = new Uint8Array(buffer);
  byteView.set(encodedText, HEADER_LENGTH);

  if (binary) {
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
  let headerView = new Uint32Array(data);
  let format = headerView[0];
  let textLength = headerView[1];

  let byteView = new Uint8Array(data);

  let decoder = new TextDecoder();

  let decoded = JSON.parse(
    decoder.decode(byteView.subarray(HEADER_LENGTH, HEADER_LENGTH + textLength))
  );

  let binaryData =
    format === MessageFormat.text_and_binary
      ? byteView.subarray(HEADER_LENGTH + textLength).slice()
      : undefined;
  return {
    type: MsgType.chat_response_audio,
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

function serializeMessage<MSG extends Message<MsgType, any>>(msg: MSG) {
  switch (msg.type) {
    case MsgType.chat_response_audio:
    case MsgType.request_audio_chat:
      return serializeAudioData(msg.type, msg.data);
    default:
      return serializeData(msg.type, msg.data);
  }
}

function deserializeMessage(msg: ArrayBuffer): Message<MsgType, any> {
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
  };
}
