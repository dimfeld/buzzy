<script lang="ts">
  import ky from 'ky';
  import { enhance } from '$app/forms';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { listenAudio } from '$lib/audio/listening';
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { machine } from '$lib/state.js';
  import { useMachine } from '@xstate/svelte';
  import { WebSocket } from 'partysocket';
  import { page } from '$app/stores';
  import {
    deserializeMessage,
    MsgType,
    sendMessage,
    type MessageWithId,
    type NewChatResponseMsg,
    type ChatResponseTextMsg,
  } from '$lib/ws.js';

  export let data;

  let formEl: HTMLFormElement;
  let chatEl: HTMLDivElement;

  const { state, send, service } = useMachine(machine);
  $: submitting = $state.matches('processing');

  const wsPath = new URL('/ws', $page.url.origin);
  wsPath.protocol = 'ws:';
  let ws: WebSocket | null = null;

  interface Message {
    /** The ID of the message for the websocket server */
    wsId?: string;
    role: 'assistant' | 'user';
    content: string;
  }

  function scrollToBottom() {
    tick().then(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }));
  }

  async function gotAudio(buffer: Int16Array) {
    sendMessage(ws, {
      type: MsgType.request_audio_chat,
      data: {
        sample_rate: 16000,
        audio: buffer.buffer,
      },
    });
  }

  /*
  async function old() {

    const result = await ky('/ask/transcribe', {
      method: 'POST',
      body,
    }).json<{ result: string }>();

    addMessage({ role: 'user', content: result.result });

    tick().then(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }));

    const chatBody = new FormData();
    chatBody.set('text', result.result);
    var assistantResponse = await ky('/ask/chat', {
      method: 'POST',
      body: chatBody,
    }).json<{ response: string }>();

    send({ type: 'GOT_ANSWER' });

    addMessage({ role: 'assistant', content: assistantResponse.response });

    if (assistantResponse) {
      await getTts(assistantResponse.response);
    }
    send({ type: 'ANSWERED' });

    // playSound(int16ToFloat32(buffer, 16000));
  }

  async function getTts(text: string) {
    const ttsReq = new FormData();
    ttsReq.set('text', text);
    const ttsResponse = await fetch('./ask/tts', {
      method: 'POST',
      body: ttsReq,
    });

    const ttsBlob = await ttsResponse.blob();
    const ttsOutputBuf = await ttsBlob.arrayBuffer();

    return playWav(ttsOutputBuf);

    //const ttsOutputFloats = new Float32Array(ttsOutputBuf);
    //playSound(ttsOutputFloats, 16000);
  }
   */

  let audioContext: AudioContext | null = null;

  async function playWav(data: ArrayBuffer) {
    if (!audioContext) {
      return null;
    }

    console.log(data);

    const buffer = await audioContext.decodeAudioData(data);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
      source.addEventListener('ended', () => resolve(null));
      source.start();
    });
  }

  onMount(() => {
    audioContext = new AudioContext();
    const audio = listenAudio(service, gotAudio);

    ws = new WebSocket(wsPath.toString());
    ws.binaryType = 'arraybuffer';
    ws.onerror = (e) => {
      console.error('ws error', e);
    };

    ws.addEventListener('open', () => {
      send({ type: 'INITIALIZED', module: 'ws' });
      sendMessage(ws!, {
        type: MsgType.client_hello,
        data: {},
      });
    });

    ws.addEventListener('message', (ev) => {
      let data = deserializeMessage(ev.data);
      handleMessage(data);
    });

    return () => {
      audio.unsubscribe();
      ws?.close();
      ws = null;
    };
  });

  function handleMessage(msg: MessageWithId) {
    console.log(msg);
    switch (msg.type) {
      case MsgType.chat_response_audio:
        // TODO enqueue the audio, don't just play it immediately
        playWav(msg.data.audio);
        break;
      case MsgType.chat_response_text:
        send({ type: 'GOT_ANSWER' });
        addToChatMessage(msg);
        break;
      case MsgType.new_chat_response:
        handleNewChatResponse(msg);
        break;
      case MsgType.chat_response_done:
        send({ type: 'ANSWERED' });
        break;
      default:
        console.error(msg);
    }
  }

  function handleNewChatResponse(msg: NewChatResponseMsg) {
    data.messages = [
      ...data.messages,
      {
        wsId: msg.data.chat_id,
        role: 'user',
        content: '',
      },
    ];

    scrollToBottom();
  }

  function addToChatMessage(msg: ChatResponseTextMsg) {
    const messageIndex = data.messages.findIndex(
      (m) => m.wsId === msg.data.chat_id && m.role === msg.data.role
    );

    if (messageIndex < 0) {
      data.messages = [
        ...data.messages,
        {
          wsId: msg.data.chat_id,
          role: msg.data.role,
          content: msg.data.text,
        },
      ];
    } else {
      data.messages[messageIndex].content += msg.data.text;
    }

    scrollToBottom();
  }

  function submitText(e: SubmitEvent) {
    if (!ws) {
      return;
    }

    sendMessage(ws, {
      type: MsgType.request_text_chat,
      data: {
        text: formEl.chat.value,
      },
    });
    formEl?.reset();
  }
</script>

<main class="flex h-full flex-col">
  <div bind:this={chatEl} class="flex flex-1 flex-col gap-8 overflow-y-auto px-8">
    {#each data.messages as message}
      <ChatBubble role={message.role}>{message.content || '...'}</ChatBubble>
    {:else}
      <ChatBubble role="assistant">Hi I'm Buzzy!</ChatBubble>
    {/each}
    {#if $state.matches('processing')}
      <ChatBubble role="assistant">Let me think...</ChatBubble>
    {/if}
  </div>
  <div>Current State: {$state.value}</div>
  <form
    bind:this={formEl}
    class="flex items-stretch gap-2"
    method="POST"
    on:submit|preventDefault={submitText}
  >
    <Textarea
      name="chat"
      class="flex-1"
      autofocus
      placeholder="Type your question here"
      on:keydown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          if (formEl.requestSubmit) {
            formEl.requestSubmit();
          } else {
            document.querySelector('#submit-button')?.click();
          }
        }
      }}
    />
    <Button id="submit-button" disabled={submitting} type="submit" class="h-auto">Submit</Button>
  </form>
</main>
