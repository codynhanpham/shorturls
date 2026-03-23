<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { UseClipboard } from '$lib/hooks/use-clipboard.svelte';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import XIcon from '@lucide/svelte/icons/x';
	import { scale } from 'svelte/transition';
	import type { CopyButtonProps } from '$lib/components/ui/copy-button/types';

	let {
		ref = $bindable(null),
		text,
		icon,
		animationDuration = 500,
		variant = 'ghost',
		size = 'icon',
		onCopy,
		class: className,
		tabindex = -1,
		children,
		...rest
	}: CopyButtonProps = $props();

	// this way if the user passes text then the button will be the default size
	// svelte-ignore state_referenced_locally
		if (size === 'icon' && children) {
		size = 'default';
	}

	const clipboard = new UseClipboard();
</script>

<Button
	{...rest}
	bind:ref
	{variant}
	{size}
	{tabindex}
	class={cn('flex items-center gap-2 py-1', className)}
	type="button"
	name="copy"
	onclick={async () => {
		const status = await clipboard.copy(text);

		onCopy?.(status);
	}}
>
	{#if clipboard.status === 'success'}
		<div class="shrink-0 self-center" in:scale={{ duration: animationDuration, start: 0.85 }}>
			<CheckIcon tabindex={-1} />
			<span class="sr-only">Copied</span>
		</div>
	{:else if clipboard.status === 'failure'}
		<div class="shrink-0 self-center" in:scale={{ duration: animationDuration, start: 0.85 }}>
			<XIcon tabindex={-1} />
			<span class="sr-only">Failed to copy</span>
		</div>
	{:else}
		<div class="shrink-0 self-center" in:scale={{ duration: animationDuration, start: 0.85 }}>
			{#if icon}
				{@render icon()}
			{:else}
				<CopyIcon tabindex={-1} />
			{/if}
			<span class="sr-only">Copy</span>
		</div>
	{/if}
	<div class="min-w-0 grow text-left">
		{@render children?.()}
	</div>
</Button>
