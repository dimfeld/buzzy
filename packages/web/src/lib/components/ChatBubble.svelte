<script lang="ts">
  import { cn } from '$lib/utils';

  export let role: 'user' | 'assistant';
</script>

<div
  class={cn(
    'w-2/3 rounded-lg p-4 shadow-lg',
    role === 'user' ? 'self-start bg-green-500' : 'self-end bg-yellow-600'
  )}
>
  <slot />
</div>
