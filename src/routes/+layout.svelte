<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Disallow crawling of all pages -->
	<meta name="robots" content="noindex, nofollow" />
	<title>Short URLs</title>
</svelte:head>

{@render children()}