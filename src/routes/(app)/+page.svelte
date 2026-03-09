<script lang="ts">
    import type { PageData } from "./$types";

    import { Button } from "$lib/components/ui/button/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import * as Field from "$lib/components/ui/field/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
	import * as InputGroup from "$lib/components/ui/input-group/index.js";
    import Textarea from "$src/lib/components/ui/textarea/textarea.svelte";
	import { TagsInput } from "$lib/components/ui/tags-input";

	import { env } from '$env/dynamic/public';
    import { cn } from "$src/lib/utils";

    let { data }: { data: PageData } = $props();


	let fullUrl = $state("");
	let shortUrl = $state("");

	let isEphemeral = $state(false);
</script>

<main class="h-full">
    <!-- Add New -->
    <section class="p-3 pt-2.5 bg-card rounded-lg border">
        <form>
            <Field.Group class="**:[div]:gap-0.5! **:[input]:mt-1 **:[input]:bg-input/15 **:[textarea]:bg-input/15 **:data-[slot='field']:mt-3 **:data-[slot='field-label']:text-base">
                <Field.Set class="gap-1 **:data-[slot='field']:px-2.5 **:data-[slot='field']:py-1.5 **:data-[slot='field']:border-l-2 **:data-[slot='field']:rounded-lg ">
                    <Field.Legend class="ml-1 mb-1.5 text-lg!">Add new URL</Field.Legend>
                    <Field.Description class="ml-1">
						Shorten a new web address that will be available globally
					</Field.Description
                    >
                    <Field.Group>
						<Field.Field class="border-amber-500/30 focus-within:border-amber-500/90 active:border-amber-500/90">
                            <Field.Label for="full-url">Full URL</Field.Label>
							<Field.Description>Enter the full URL you want to shorten</Field.Description
							>
                            <Input
								bind:value={fullUrl}
								required
                                id="full-url"
                                autocomplete="off"
								aria-invalid={false}
                                placeholder="https://example.com/long-url?query=anything"
                            />
                        </Field.Field>

						{#if fullUrl.trim() !== ""}
							<Field.Group class="group/short-url-row flex flex-col sm:flex-row gap-2">
								<Field.Field class="border-emerald-500/30 focus-within:border-emerald-500/90 active:border-emerald-500/90 group-focus-within/short-url-row:border-emerald-500/90 group-active/short-url-row:border-emerald-500/90 w-full grow">
									<Field.Label for="short-url">Short URL</Field.Label>
									<Field.Description>Choose a unique short URL identifier</Field.Description>
									<InputGroup.Root class="mt-1 bg-input/15">
										<InputGroup.Input
											bind:value={shortUrl}
											required
											id="short-url"
											autocomplete="off"
											aria-invalid={false}
											class="pl-0! mt-0! bg-transparent!"
											placeholder="my-short-url"
										/>
										<InputGroup.Addon align="inline-start" class="font-semibold">https://{env.PUBLIC_HOSTNAME}/</InputGroup.Addon>
									</InputGroup.Root>
									<!-- <Field.Error>Something is not right...</Field.Error> -->
								</Field.Field>
								<Field.Field class="w-fit border-0! items-end mt-1!">
									<div class="flex items-center gap-1.5 mt-auto sm:mb-[calc(var(--spacing)*2+1px)]!">
										<Switch bind:checked={isEphemeral} id="ephemeral" class="mr-1.5" />
										<Field.Label for="ephemeral" class={cn("text-sm! text-muted-foreground", isEphemeral && "text-foreground")}>
											Ephemeral
										</Field.Label>
									</div>
								</Field.Field>
							</Field.Group>

							{#if isEphemeral}
								<Field.Field class="ml-3.5! mt-0! border-rose-500/30 focus-within:border-rose-500/90 active:border-rose-500/90">
									<Field.Label for="title">Expiration</Field.Label>
									<Field.Description>Expiration time settings</Field.Description
									>
									
								</Field.Field>
							{/if}

							{#if shortUrl.trim() !== ""}
								<Field.Field class="border-cyan-500/30 focus-within:border-cyan-500/90 active:border-cyan-500/90">
									<Field.Label for="title">Title</Field.Label>
									<Field.Description>Title for this short URL <i class="text-muted-foreground/80">(optional)</i></Field.Description
									>
									<Input
										id="title"
										autocomplete="off"
										aria-invalid={false}
										placeholder="My Short URL"
									/>
								</Field.Field>

								<Field.Field class="border-stone-500/30 focus-within:border-stone-500/90 active:border-stone-500/90">
									<Field.Label for="comments">Comments</Field.Label>
									<Field.Description>Comments or notes for this short URL <i class="text-muted-foreground/80">(optional)</i></Field.Description
									>
									<Textarea
										id="comments"
										autocomplete="off"
										aria-invalid={false}
										placeholder="My Short URL"
									/>
								</Field.Field>

								<Field.Field class="border-purple-400/30 focus-within:border-purple-400/90 active:border-purple-400/90">
									<Field.Label for="tags">Tags</Field.Label>
									<Field.Description>Tags for more convenient organization <i class="text-muted-foreground/80">(optional)</i></Field.Description
									>
									<TagsInput
										id="tags"
										autocomplete="off"
										aria-invalid={false}
										placeholder="e.g. social media, programming, etc."
										class="mt-1 bg-input/15 **:[input]:mt-0! **:[input]:bg-transparent!"
									/>
								</Field.Field>

								<Button class="self-center my-1.5 " type="submit">Create Short URL</Button>
							{/if}
						{/if}
                    </Field.Group>
                </Field.Set>
            </Field.Group>
        </form>
    </section>

    <!-- <section class="space-y-3 py-4">
		<h1 class="text-xl font-semibold">Cloudflare KV keys</h1>

		{#if data.kvError}
			<p class="text-sm text-destructive">{data.kvError}</p>
		{:else if data.kvKeys.length === 0}
			<p class="text-sm text-muted-foreground">No keys found.</p>
		{:else}
			<p class="text-sm text-muted-foreground">
				Showing {data.kvKeys.length} key(s) from the first KV page (max 1000).
			</p>

			{#if !data.listComplete}
				<p class="text-sm text-muted-foreground">
					More keys exist. Next cursor: <code>{data.nextCursor}</code>
				</p>
			{/if}

			<ul class="space-y-1">
				{#each data.kvKeys as key}
					<li class="rounded-md border px-3 py-2 text-sm font-mono">{key.name}</li>
				{/each}
			</ul>
		{/if}
	</section> -->
</main>
