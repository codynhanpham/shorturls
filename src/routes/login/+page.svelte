<script lang="ts">
	import type { ActionData } from './$types';

	import LoginForm from '$src/routes/login/login-form.svelte';
	
	let { form }: { form?: ActionData } = $props();
</script>

<svelte:head>
	<title>Login - Short URLs</title>
</svelte:head>

<div class="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="w-full max-w-sm">
		<LoginForm {form} />
	</div>
</div>