<script lang="ts">
  import { Textarea } from '$lib/components/ui/textarea';
  let nextChat = '';
</script>

<main class="flex h-full flex-col">
  <div class="flex-1">Response</div>
  <Textarea bind:value={nextChat} placeholder="Type your question here" />
</main>
