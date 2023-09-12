<script lang="ts">
  import { enhance } from '$app/forms';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';

  export let form;

  let formEl: HTMLFormElement;
  let chatEl: HTMLDivElement;

  let submitting = false;

  interface Message {
    role: 'assistant' | 'user';
    content: string;
  }
  let messages: Message[] = [{ role: 'assistant', content: `Hi I'm Buzzy!` }];

  const handleSubmit: SubmitFunction = async ({ formData, cancel }) => {
    const chat = formData.get('chat') as string;
    if (!chat) {
      cancel();
    }

    messages = [...messages, { role: 'user', content: chat }];

    submitting = true;
    setTimeout(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }), 0);

    return async function ({ update, result }) {
      submitting = false;
      console.dir(result);
      await update();
      if (result.type === 'success' && result.data?.response) {
        messages = [
          ...messages,
          {
            role: 'assistant',
            content: result.data.response,
          },
        ];

        setTimeout(() => chatEl?.scroll({ top: chatEl.scrollHeight, behavior: 'smooth' }), 0);
      }
    };
  };
</script>

<main class="flex h-full flex-col">
  <div bind:this={chatEl} class="flex flex-1 flex-col gap-8 overflow-y-auto px-8">
    {#each messages as message}
      <ChatBubble role={message.role}>{message.content}</ChatBubble>
    {/each}
    {#if submitting}
      <ChatBubble role="assistant">Thinking...</ChatBubble>
    {/if}
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
