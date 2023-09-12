<script lang="ts">
  import { enhance } from '$app/forms';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import Button from '$lib/components/ui/button/button.svelte';

  export let form;

  let formEl: HTMLFormElement;
</script>

<main class="flex h-full flex-col">
  <div class="flex-1">Response: {form?.response || ''}</div>
  <form
    bind:this={formEl}
    class="flex items-stretch gap-2"
    method="POST"
    use:enhance={({ formData, cancel }) => {
      if (!formData.get('chat')) {
        cancel();
      }
    }}
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
    <Button id="submit-button" type="submit" class="h-auto">Submit</Button>
  </form>
</main>
