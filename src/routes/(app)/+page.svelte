<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import type { PageProps } from "./$types";

	import { deleteShortUrl, listCachedShortUrls, syncShortUrls, upsertShortUrlInCache } from "$lib/db";
	import { Button } from "$lib/components/ui/button/index.js";
	import Kbd from "$src/lib/components/ui/kbd/kbd.svelte";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import * as InputGroup from "$lib/components/ui/input-group/index.js";
	import Textarea from "$src/lib/components/ui/textarea/textarea.svelte";
	import { TagsInput } from "$lib/components/ui/tags-input";
	import { CopyButton } from '$lib/components/ui/copy-button';
	import type { ShortUrlDBEntry } from "$lib/types/shorturls";

	import DateNTimePicker from "$src/lib/components/blocks/date-n-time-picker.svelte";
	import {
		getLocalTimeZone,
		parseAbsoluteToLocal,
		Time,
		today,
		toCalendarDateTime,
		toZoned,
		type ZonedDateTime
	} from "@internationalized/date";
	import { onMount, untrack } from "svelte";

	import { CornerDownLeft, CornerDownRight, Delete, LoaderCircle, Copy, Trash2 } from "@lucide/svelte";

	import { env } from "$env/dynamic/public";
	import { cn } from "$src/lib/utils";

	type CreateShortUrlFieldErrors = Partial<Record<"url" | "key" | "expiration", string>>;
	type CreateShortUrlFormFields = {
		url?: string;
		key?: string;
		title?: string;
		description?: string;
		tags?: string[];
		isEphemeral?: boolean;
		expiration?: string;
	};
	type CreateShortUrlFormState = {
		error?: string;
		message?: string;
		fieldErrors?: CreateShortUrlFieldErrors;
		fields?: CreateShortUrlFormFields;
		createdEntry?: ShortUrlDBEntry;
	};

	let { form, data }: PageProps = $props();
	const formState = $derived((form ?? {}) as CreateShortUrlFormState);
	const fieldErrors = $derived(formState.fieldErrors ?? {});

	let displayedEntries = $state<ShortUrlDBEntry[]>([]);
	let isEntriesLoading = $state(true);
	let entriesError = $state<string | null>(null);
	let isBackgroundSyncing = $state(false);

	const LAST_SYNC_AT_KEY = "shorturls:lastSyncAtMs";
	const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

	let fullUrl = $state(untrack(() => formState.fields?.url ?? ""));
	let shortUrl = $state(untrack(() => formState.fields?.key ?? ""));
	let title = $state(untrack(() => formState.fields?.title ?? ""));
	let description = $state(untrack(() => formState.fields?.description ?? ""));
	let tags = $state<string[]>(untrack(() => formState.fields?.tags ?? []));
	let isSubmitting = $state(false);
	let deletingEntryKey = $state<string | null>(null);
	let lastCreatedKey = $state<string | null>(null);
	let highlightFirstEntry = $state(false);
	let highlightTimeoutId: ReturnType<typeof setTimeout> | null = null;

	let isEphemeral: boolean = $state(untrack(() => formState.fields?.isEphemeral ?? false));

	const localTimeZone = getLocalTimeZone();
	const defaultEphemeralExpiration = () => {
		const tomorrow = today(localTimeZone).add({ days: 1 });
		return toZoned(toCalendarDateTime(tomorrow, new Time(23, 59, 59)), localTimeZone);
	};

	let expirationDate: ZonedDateTime | undefined = $state(
		untrack(() =>
			formState.fields?.expiration
				? parseAbsoluteToLocal(formState.fields.expiration)
				: defaultEphemeralExpiration()
		)
	);
	const expirationIso = $derived(
		isEphemeral && expirationDate ? expirationDate.toAbsoluteString() : ""
	);

	const resetCreateShortUrlForm = () => {
		fullUrl = "";
		shortUrl = "";
		title = "";
		description = "";
		tags = [];
		isEphemeral = false;
		expirationDate = defaultEphemeralExpiration();
	};

	const handleCreateShortUrlSubmit: SubmitFunction = () => {
		isSubmitting = true;

		return async ({ result }) => {
			isSubmitting = false;
			await applyAction(result);
		};
	};

	const formatRelativeTime = (dateStr: string): string => {
		const diffMs = new Date(dateStr).getTime() - Date.now();
		const diffSec = Math.round(diffMs / 1000);
		const diffMin = Math.round(diffSec / 60);
		const diffHour = Math.round(diffMin / 60);
		const diffDay = Math.round(diffHour / 24);
		const diffMonth = Math.round(diffDay / 30);
		const diffYear = Math.round(diffDay / 365);
		const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
		if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
		if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
		if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
		if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
		if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
		return rtf.format(diffYear, "year");
	};

	const refreshDisplayedEntries = async () => {
		const entries = await listCachedShortUrls();
		displayedEntries = entries.sort(
			(a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
		);
	};

	const readLastSyncAtMs = () => {
		const rawValue = localStorage.getItem(LAST_SYNC_AT_KEY);
		if (!rawValue) {
			return null;
		}

		const parsedValue = Number(rawValue);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	};

	const writeLastSyncAtMs = (value: number) => {
		localStorage.setItem(LAST_SYNC_AT_KEY, String(value));
	};

	const runSyncIfNeeded = async (force = false) => {
		if (data.kvError) {
			if (force) {
				entriesError = data.kvError;
			}
			return;
		}

		const now = Date.now();
		const lastSyncAt = readLastSyncAtMs();
		const shouldSync =
			force || lastSyncAt === null || now - lastSyncAt >= BACKGROUND_SYNC_INTERVAL_MS;

		if (!shouldSync) {
			return;
		}

		isBackgroundSyncing = true;

		try {
			await syncShortUrls();
			writeLastSyncAtMs(Date.now());
			window.dispatchEvent(new Event('session:renewed'));
			await refreshDisplayedEntries();
		} catch (error) {
			console.error("Background sync failed", error);
			entriesError = "Failed to synchronize with Cloudflare KV.";
		} finally {
			isBackgroundSyncing = false;
		}
	};

	const handleDeleteEntry = async (entry: ShortUrlDBEntry) => {
		const shouldDelete = window.confirm(
			`Delete short URL "${entry.key}"? This will remove it from Cloudflare KV and your local cache.`
		);

		if (!shouldDelete) {
			return;
		}

		deletingEntryKey = entry.key;

		try {
			await deleteShortUrl(entry.key);
			window.dispatchEvent(new Event('session:renewed'));
			await refreshDisplayedEntries();
		} catch (error) {
			console.error("Failed to delete short URL", error);
			entriesError = error instanceof Error ? error.message : "Failed to delete short URL.";
		} finally {
			deletingEntryKey = null;
		}
	};

	$effect(() => {
		if (isEphemeral && !expirationDate) {
			expirationDate = defaultEphemeralExpiration();
		}
	});

	onMount(() => {
		void (async () => {
			isEntriesLoading = true;
			entriesError = null;

			try {
				await refreshDisplayedEntries();
			} catch (error) {
				console.error("Failed to load short URLs from Dexie", error);
				entriesError = "Failed to load short URL entries from local cache.";
			} finally {
				isEntriesLoading = false;
			}

			await runSyncIfNeeded(false);
		})();

		const handleManualSync = () => {
			void runSyncIfNeeded(true);
		};

		window.addEventListener("shorturls:manual-sync", handleManualSync);

		return () => {
			if (highlightTimeoutId) {
				clearTimeout(highlightTimeoutId);
				highlightTimeoutId = null;
			}

			window.removeEventListener("shorturls:manual-sync", handleManualSync);
		};
	});

	$effect(() => {
		const createdEntry = formState.createdEntry;
		if (!createdEntry || createdEntry.key === lastCreatedKey) {
			return;
		}

		lastCreatedKey = createdEntry.key;
		resetCreateShortUrlForm();

		void (async () => {
			await upsertShortUrlInCache(createdEntry);
			await refreshDisplayedEntries();

			highlightFirstEntry = true;
			if (highlightTimeoutId) {
				clearTimeout(highlightTimeoutId);
			}
			highlightTimeoutId = setTimeout(() => {
				highlightFirstEntry = false;
				highlightTimeoutId = null;
			}, 2000);
		})();
	});

	
</script>

<svelte:head>
	<title>Dashboard - Short URLs</title>
</svelte:head>

<main class="h-auto">
    <!-- Add New -->
    <section class="p-3 pt-2.5 bg-card rounded-lg border">
        <form method="POST" use:enhance={handleCreateShortUrlSubmit}>
            <input type="hidden" name="isEphemeral" value={isEphemeral ? "true" : "false"} />
            <input type="hidden" name="expiration" value={expirationIso} />
            {#each tags as tag (tag)}
                <input type="hidden" name="tags" value={tag} />
            {/each}
            <Field.Group class="**:data-[slot='field']:gap-0.5! **:data-[slot='field-group']:gap-0.5! **:[input]:mt-1 **:[input]:bg-input/15 **:[textarea]:bg-input/15 **:data-[slot='field']:mt-3 **:data-[slot='field-label']:text-base">
                <Field.Set class="gap-1 **:data-[slot='field']:px-2.5 **:data-[slot='field']:py-1.5 **:data-[slot='field']:border-l-2 **:data-[slot='field']:rounded-lg ">
                    <Field.Legend class="ml-1 mb-1.5 text-lg!">Add new URL</Field.Legend>
                    <Field.Description class="ml-1">
						Shorten a new web address that will be available globally
					</Field.Description
                    >
					{#if formState.error}
						<p class="ml-1 text-sm text-destructive">{formState.error}</p>
                    {/if}
                    <Field.Group>
						<Field.Field class="border-amber-500/30 focus-within:border-amber-500/90 active:border-amber-500/90">
                            <Field.Label for="full-url">Full URL</Field.Label>
							<Field.Description>Enter the full URL you want to shorten</Field.Description
							>
                            <Input
								bind:value={fullUrl}
								name="url"
								required
                                id="full-url"
                                autocomplete="off"
								aria-invalid={Boolean(fieldErrors.url)}
                                placeholder="https://example.com/long-url?query=anything"
                            />
							{#if fieldErrors.url}
								<Field.Error>{fieldErrors.url}</Field.Error>
							{/if}
                        </Field.Field>

						{#if fullUrl.trim() !== ""}
							<Field.Group class="group/short-url-row flex flex-col sm:flex-row gap-2">
								<Field.Field class="border-emerald-500/30 focus-within:border-emerald-500/90 active:border-emerald-500/90 group-focus-within/short-url-row:border-emerald-500/90 group-active/short-url-row:border-emerald-500/90 w-full grow">
									<Field.Label for="short-url">Short URL</Field.Label>
									<Field.Description>Choose a unique short URL identifier</Field.Description>
									<InputGroup.Root class="mt-1 bg-input/15">
										<InputGroup.Input
											bind:value={shortUrl}
											name="key"
											required
											id="short-url"
											autocomplete="off"
											aria-invalid={Boolean(fieldErrors.key)}
											class="pl-0! mt-0! bg-transparent! py-2"
											placeholder="my-short-url"
										/>
										<InputGroup.Addon align="inline-start" class="font-medium text-base text-muted-foreground/80">https://{env.PUBLIC_HOSTNAME}/</InputGroup.Addon>
									</InputGroup.Root>
									{#if fieldErrors.key}
										<Field.Error>{fieldErrors.key}</Field.Error>
									{/if}
								</Field.Field>
								<Field.Field class="w-fit border-0! items-end mt-1!">
									<div class="flex items-center gap-1.5 mt-auto sm:mb-[calc(var(--spacing)*2+1px)]!">
										<Switch bind:checked={isEphemeral} id="ephemeral" class="mr-1.5 cursor-pointer" />
										<Field.Label for="ephemeral" class={cn("text-sm! text-muted-foreground cursor-pointer", isEphemeral && "text-foreground")}>
											Ephemeral
										</Field.Label>
									</div>
								</Field.Field>
							</Field.Group>

							{#if isEphemeral}
								<Field.Field class="ml-3.5! mt-0! border-rose-500/30 focus-within:border-rose-500/90 active:border-rose-500/90">
									<Field.Label for="expiration">Expiration</Field.Label>
									<Field.Description>Expiration time settings</Field.Description>
									<DateNTimePicker
										bind:value={expirationDate}
										id="expiration"
										class="mt-2"
										nlpDateTimeLabel="Expiration datetime (NLP)"
										datePlaceholder="Select date"
										dateLabel="Expiration date"
										timeLabel="Expiration time"
									/>
									{#if fieldErrors.expiration}
										<Field.Error>{fieldErrors.expiration}</Field.Error>
									{/if}
								</Field.Field>
							{/if}

							{#if shortUrl.trim() !== ""}
								<Field.Field class="border-cyan-500/30 focus-within:border-cyan-500/90 active:border-cyan-500/90">
									<Field.Label for="title">Title</Field.Label>
									<Field.Description>Title for this short URL <i class="text-muted-foreground/80">(optional)</i></Field.Description
									>
									<Input
										bind:value={title}
										name="title"
										id="title"
										autocomplete="off"
										aria-invalid={false}
										placeholder="My Short URL"
									/>
								</Field.Field>

								<Field.Field class="border-stone-500/30 focus-within:border-stone-500/90 active:border-stone-500/90">
									<Field.Label for="comments">Comments</Field.Label>
									<Field.Description>Comments or notes about this short URL <i class="text-muted-foreground/80">(optional)</i></Field.Description
									>
									<Textarea
										bind:value={description}
										name="description"
										id="comments"
										autocomplete="off"
										aria-invalid={false}
										placeholder="My Short URL"
									/>
								</Field.Field>

								<Field.Field class="border-purple-400/30 focus-within:border-purple-400/90 active:border-purple-400/90">
									<Field.Label for="tags">Tags</Field.Label>
									<Field.Description>
									<p>
										Tags for more convenient organization <i class="text-muted-foreground/80">(optional)</i>
									</p>
									<p>
										<Kbd class="font-semibold"><CornerDownLeft /> Enter</Kbd> to add a tag, <Kbd class="font-semibold"><Delete /> Backspace</Kbd> to remove
									</p>
									</Field.Description
									>
									<TagsInput
										bind:value={tags}
										id="tags"
										autocomplete="off"
										aria-invalid={false}
										placeholder="e.g. social media, programming, etc."
										class="mt-1 bg-input/15 **:[input]:mt-0! **:[input]:bg-transparent!"
									/>
								</Field.Field>

								<Button class="self-center my-1.5 " type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Creating..." : "Create Short URL"}
								</Button>
							{/if}
						{/if}
                    </Field.Group>
                </Field.Set>
            </Field.Group>
        </form>
    </section>

	<!-- List -->
	<section class="mt-4 p-3 bg-card rounded-lg border">
		<h2 class="text-lg font-semibold">Current entries</h2>

		{#if data.kvError}
			<p class="mt-1 text-sm text-destructive">{data.kvError}</p>
		{/if}

		{#if entriesError}
			<p class="mt-1 text-sm text-destructive">{entriesError}</p>
		{:else if isEntriesLoading}
			<p class="mt-1 text-sm text-muted-foreground">Loading entries from local cache...</p>
		{:else if displayedEntries.length === 0}
			<p class="mt-1 text-sm text-muted-foreground">No short URLs found.</p>
		{:else}
			<p class="mt-1 text-sm text-muted-foreground">
				Showing {displayedEntries.length} synced entries from local cache.
			</p>

			{#if isBackgroundSyncing}
				<p class="mt-1 text-xs text-muted-foreground"><LoaderCircle class="inline size-3 animate-spin mr-1"/>Background syncing with Cloudflare KV...</p>
			{/if}

			<ul class="mt-3 space-y-2">
				{#each displayedEntries as entry, index (entry.key)}
					<li
						class={cn(
							"short-url-entry rounded-md border px-3 py-2 text-sm space-y-1.5 transition-colors duration-300",
							index === 0 && highlightFirstEntry && "border-emerald-500 bg-emerald-500/5"
						)}
						id="shorturl-entry-{entry.key}"
					>
						<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-0">
							<p class="font-medium text-lg">{entry.title || entry.key}</p>
							<p class="text-xs text-muted-foreground">
								Modified: <time datetime={entry.modifiedAt} title={new Date(entry.modifiedAt).toLocaleString()} class="cursor-help border-b border-dotted border-current">{formatRelativeTime(entry.modifiedAt)}</time>
							</p>
						</div>
						
						<CopyButton
							text={`https://${env.PUBLIC_HOSTNAME}/${entry.key}`}
							size="sm"
							variant="outline"
							animationDuration={500}
							class="bg-transparent **:[svg]:size-3.5! max-w-full w-full sm:w-auto h-auto whitespace-normal! items-start justify-start"
							>
							{#snippet icon()}
								<Copy />
							{/snippet}
							<span class="font-mono text-sm font-light w-full min-w-0 break-all text-left">
								{`https://${env.PUBLIC_HOSTNAME}/${entry.key}`}
							</span>
						</CopyButton>

						<p class="text-sm ml-2 text-muted-foreground flex items-start gap-1">
							<CornerDownRight class="size-3.5 mt-0.5 shrink-0" />
							<a
								href={entry.url}
								target="_blank"
								rel="noopener"
								class="w-fit min-w-0 break-all text-muted-foreground hover:underline [display:-webkit-box] line-clamp-4 sm:line-clamp-3 [-webkit-line-clamp:4] sm:[-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden"
								title={entry.url}
							>{entry.url}</a>
						</p>

						{#if entry.description}
							<p class="font-normal">{entry.description}</p>
						{/if}

						{#if entry.tags && entry.tags.length > 0}
							<div class="flex flex-wrap gap-1 pt-0.5">
								{#each entry.tags as tag (tag)}
									<span class="rounded bg-muted px-2 py-0.5 text-xs">{tag}</span>
								{/each}
							</div>
						{/if}

						<div class="mb-1 w-full flex flex-wrap items-center justify-between gap-2">
							{#if entry.expiration !== null}
								<p class="text-xs text-muted-foreground">
									Expires: {new Date(entry.expiration * 1000).toLocaleString()} ({formatRelativeTime(new Date(entry.expiration * 1000).toISOString())})
								</p>
							{/if}
							<div class="ml-auto self-end flex items-center gap-1">
								<!-- Delete Button -->
								<Button
									type="button"
									variant="destructive"
									size="sm"
									class="bg-transparent border-border border"
									disabled={deletingEntryKey === entry.key}
									onclick={() => void handleDeleteEntry(entry)}
								>
									{#if deletingEntryKey === entry.key}
										<LoaderCircle class="mr-1 size-3.5 animate-spin" />
										Deleting...
									{:else}
										<Trash2 class="mr-1 size-3.5" />
										Delete
									{/if}
								</Button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>
