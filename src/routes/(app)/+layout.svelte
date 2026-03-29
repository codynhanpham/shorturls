<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
    
	import {
    ChevronDown,
        ChevronUp,
		CirclePlus,
        CloudSync,
        LogOut,
        Search,
	} from "@lucide/svelte";
	import { DURATION_MINUTES } from '$lib/auth';

	let { children, data }: { children: any; data: any } = $props();
	let isAuthenticated = $derived(data.user?.authenticated ?? false);
	let idleLogoutForm: HTMLFormElement;

	let lastRenewed = $state(Date.now());

	// Sync when layout data refreshes (navigations, form actions re-run load)
	$effect(() => {
		lastRenewed = data.sessionIssuedAt;
	});

	// Idle logout countdown — resets on any authenticated server request
	$effect(() => {
		if (!isAuthenticated) return;

		const IDLE_TIMEOUT_MS = DURATION_MINUTES * 60 * 1000;
		const remaining = Math.max(0, lastRenewed + IDLE_TIMEOUT_MS - Date.now());
		const timer = setTimeout(() => idleLogoutForm.requestSubmit(), remaining);

		const onRenewed = () => { lastRenewed = Date.now(); };
		window.addEventListener('session:renewed', onRenewed);

		return () => {
			clearTimeout(timer);
			window.removeEventListener('session:renewed', onRenewed);
		};
	});

	function focusFullUrlInput() {
		const input = document.getElementById("full-url") as HTMLInputElement | null;
		if (input) {
			input.scrollIntoView({ behavior: "smooth", block: "center" });
			input.focus();
		}
	}

	function triggerManualSync() {
		window.dispatchEvent(new CustomEvent("shorturls:manual-sync"));
	}

</script>

<form bind:this={idleLogoutForm} action="/logout" method="POST" aria-hidden="true" style="display:none"></form>

{#if isAuthenticated}
	<div class="app-layout relative h-full">
		<nav class="fixed bottom-0 top-auto md:top-0 md:bottom-auto left-0 w-full h-(--header-height) flex items-center justify-center gap-1.5 p-2 z-99999">
			<Button variant="outline" class="bg-background/40 backdrop-blur-xl rounded-xl h-full aspect-square md:aspect-auto border-accent-foreground/25 border text-base" title="Synchronize with Cloudflare KV" onclick={() => {
				window.scrollTo({ top: 0, behavior: "smooth" });
				triggerManualSync();
			}}>
				<CloudSync class="size-5.5" />
				<span class="sr-only md:not-sr-only mb-px">Sync</span>
			</Button>

			<div class="w-fit h-full border-accent-foreground/30 border rounded-xl flex items-center justify-center gap-1 p-1 **:[button]:rounded-lg **:[button]:font-semibold **:[button]:text-base **:[button]:w-fit **:[button]:h-full **:data-[slot='button-group']:h-full bg-background/40 backdrop-blur-xl">
				<Button
					class="bg-primary/85 hover:bg-primary"
					title="Create new short URL"
					onclick={focusFullUrlInput}
				>
					<CirclePlus class="size-4.5" />
					<span>New</span>
				</Button>
				
				<ButtonGroup.Root class="rounded-lg **:[button]:bg-background/50 **:[button]:hover:bg-accent/90 **:[button]:border-accent-foreground/20">
					<Button variant="outline" class="" title="Scroll to top" onclick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
						<ChevronUp class="size-4.5" />
					</Button>
					<Button variant="outline" class="" title="Scroll to bottom" onclick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
						<ChevronDown class="size-4.5" />
					</Button>
				</ButtonGroup.Root>
				
				<Button variant="secondary" class="bg-secondary/80 hover:bg-secondary border border-accent-foreground/20" title="Search short URLs">
					<Search class="size-4.5" />
					<span class="sr-only">Search</span>
				</Button>
			</div>
			
			<form action="/logout" method="POST" class="h-full">
				<Button variant="outline" class="bg-background/40 backdrop-blur-xl h-full aspect-square border-accent-foreground/25 border hover:border-destructive/50 rounded-xl hover:bg-destructive/70 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60" title="Log out" type="submit">
					<LogOut class="size-5.5" />
					<span class="sr-only">Log out</span>
				</Button>
			</form>
		</nav>

		<div class="pb-(--header-height) pt-4 md:pb-4 md:pt-(--header-height) h-auto max-w-prose sm:max-w-[78ch] md:max-w-[90ch] lg:max-w-[104ch] xl:max-w-[120ch] 2xl:max-w-[138ch] mx-auto px-4">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style lang="postcss">
	.app-layout {
		--header-height: calc(var(--spacing) * 16);
	}
</style>