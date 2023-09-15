<script lang="ts">
  import { enhance } from '$app/forms';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { listenAudio, type ListenerState } from '$lib/audio/listening';
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';

  export let data;

  let formEl: HTMLFormElement;
  let chatEl: HTMLDivElement;

  let submitting = false;

  let latest = '';

  function gotAudio(buffer: Int16Array) {
    latest = `Got ${buffer.length} samples of audio at ${new Date()}`;
    playSound(buffer);
  }

  let listenerState: Writable<ListenerState> | null = null;
  let audioContext: AudioContext | null = null;

  function playSound(data: Int16Array) {
    if (!audioContext) {
      return;
    }

    let buffer = audioContext.createBuffer(1, data.length, 16000);
    let float32Array = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      float32Array[i] = data[i] / 0x8000; // Convert from Int16 to Float32
    }

    buffer.copyToChannel(float32Array, 0);

    let source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  }

  onMount(() => {
    audioContext = new AudioContext();
    const audio = listenAudio(gotAudio);
    listenerState = audio.listenerState;
    return audio.unsubscribe;
  });

  interface Message {
    id: number;
    role: 'assistant' | 'user';
    content: string;
  }

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
    {#if submitting}
      <ChatBubble role="assistant">Let me think...</ChatBubble>
    {/if}
    <ChatBubble role="assistant">
      {#if $listenerState === 'waiting' && !latest}
        Listening for wake word
      {:else if $listenerState === 'active'}
        Recording...
      {:else}
        {latest}
      {/if}
    </ChatBubble>
  </div>
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
