<script lang="ts">
	import '$routes/layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data }: { children: any; data: any } = $props();
	let isAuthenticated = $derived(data.user?.authenticated ?? false);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isAuthenticated}
	<div class="app-layout">
		<nav>
			
		</nav>

		<main>
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
