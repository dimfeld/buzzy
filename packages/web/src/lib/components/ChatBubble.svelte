<script lang="ts">
  import { cn } from '$lib/utils';

  export let role: 'user' | 'assistant';
</script>

<div
  class={cn(
    'rounded-lg p-4 shadow-lg',
    role === 'user' ? 'w-2/3 self-start bg-green-500' : 'w-auto self-end bg-yellow-600'
  )}
>
  <slot />
</div>
