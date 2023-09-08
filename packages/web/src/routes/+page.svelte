<script lang="ts">
  import { enhance } from '$app/forms';
  import { Textarea } from '$lib/components/ui/textarea';
  let nextChat = '';

  export let form;

  let formEl: HTMLFormElement;

  function submitChat() {
    nextChat = '';
  }
</script>

<main class="flex h-full flex-col">
  <div class="flex-1">Response: {form?.response || ''}</div>
  <form bind:this={formEl} method="POST" use:enhance>
    <Textarea
      name="chat"
      bind:value={nextChat}
      placeholder="Type your question here"
      on:keydown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          if (formEl.requestSubmit) {
            formEl.requestSubmit();
          } else {
            formEl.submit();
          }
        }
      }}
    />
  </form>
</main>
