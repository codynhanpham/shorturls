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

	let { children, data }: { children: any; data: any } = $props();
	let isAuthenticated = $derived(data.user?.authenticated ?? false);



</script>

{#if isAuthenticated}
	<div class="app-layout relative h-full">
		<nav class="fixed bottom-0 top-auto md:top-0 md:bottom-auto left-0 w-full h-(--header-height) flex items-center justify-center gap-1.5 p-2 z-99999">
			<Button variant="outline" class="bg-background/40 backdrop-blur-xl rounded-xl h-full aspect-square md:aspect-auto border-accent-foreground/25 border text-base" title="Synchronize with Cloudflare KV">
				<CloudSync class="size-5.5" />
				<span class="sr-only md:not-sr-only mb-px">Sync</span>
			</Button>

			<div class="w-fit h-full border-accent-foreground/30 border rounded-xl flex items-center justify-center gap-1 p-1 **:[button]:rounded-lg **:[button]:font-semibold **:[button]:text-base **:[button]:w-fit **:[button]:h-full **:data-[slot='button-group']:h-full bg-background/40 backdrop-blur-xl">
				<Button
					class="bg-primary/85 hover:bg-primary"
					title="Create new short URL"
				>
					<CirclePlus class="size-4.5" />
					<span>New</span>
				</Button>
				
				<ButtonGroup.Root class="rounded-lg **:[button]:bg-background/50 **:[button]:hover:bg-accent/90 **:[button]:border-accent-foreground/20">
					<Button variant="outline" class="" title="Scroll to top">
						<ChevronUp class="size-4.5" />
					</Button>
					<Button variant="outline" class="" title="Scroll to bottom">
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

		<main class="pb-(--header-height) md:pb-0 md:pt-(--header-height) h-full max-w-prose sm:max-w-[70ch] md:max-w-[78ch] lg:max-w-[90ch] xl:max-w-[105ch] 2xl:max-w-[120ch] mx-auto px-4">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<style lang="postcss">
	.app-layout {
		--header-height: calc(var(--spacing) * 16);
	}
</style>