<script lang="ts">
  import ky from 'ky';
  import { enhance } from '$app/forms';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { listenAudio, type ListenerState } from '$lib/audio/listening';
  import { onMount, tick } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { machine } from '$lib/state.js';
  import { useMachine } from '@xstate/svelte';

  export let data;

  let formEl: HTMLFormElement;
  let chatEl: HTMLDivElement;

  const { state, send, service } = useMachine(machine);
  $: submitting = $state.matches('processing');

  interface Message {
    role: 'assistant' | 'user';
    content: string;
  }

  function addMessage(message: Message) {
    data.messages = [...data.messages, message];
    tick().then(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }));
  }

  async function gotAudio(buffer: Int16Array) {
    const body = new FormData();
    body.set('sample_rate', '16000');
    body.set('data', new File([buffer], 'audio.bin', { type: 'application/octet-stream' }));

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

  let audioContext: AudioContext | null = null;

  function int16ToFloat32(data: Int16Array) {
    let float32Array = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      float32Array[i] = data[i] / 0x8000; // Convert from Int16 to Float32
    }

    return float32Array;
  }

  async function playWav(data: ArrayBuffer) {
    if (!audioContext) {
      return null;
    }

    const buffer = await audioContext.decodeAudioData(data);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    return new Promise((resolve) => {
      source.addEventListener('ended', () => resolve(null));
      source.start();
    });
  }

  function playSound(data: Float32Array, sampleRate: number) {
    if (!audioContext) {
      return;
    }

    let buffer = audioContext.createBuffer(1, data.length, sampleRate);

    buffer.copyToChannel(data, 0);

    let source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  }

  onMount(() => {
    audioContext = new AudioContext();
    const audio = listenAudio(service, gotAudio);
    listenerState = audio.listenerState;
    return audio.unsubscribe;
  });

  const handleSubmit: SubmitFunction = async ({ formData, cancel }) => {
    const chat = formData.get('chat') as string;
    if (!chat) {
      cancel();
    }

    data.messages = [...data.messages, { role: 'user', content: chat }];

    submitting = true;
    setTimeout(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }), 0);

    return async function ({ update, result }) {
      submitting = false;
      await update();
      if (result.type === 'success' && result.data?.response) {
        getTts(result.data.response);
        setTimeout(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }), 0);
      }
    };
  };
</script>

<main class="flex h-full flex-col">
  <div bind:this={chatEl} class="flex flex-1 flex-col gap-8 overflow-y-auto px-8">
    {#each data.messages as message}
      <ChatBubble role={message.role}>{message.content}</ChatBubble>
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
    use:enhance={handleSubmit}
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
