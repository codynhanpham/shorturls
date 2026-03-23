import { browser } from '$app/environment';

import type { ShortUrlDBEntry, ShortUrlMetadata } from '$lib/types/shorturls';

export type ShortUrlListItem = {
	key: string;
	expiration: number | null;
	metadata: ShortUrlMetadata | null;
};

export type ListShortUrlsPage = {
	items: ShortUrlListItem[];
	listComplete: boolean;
	nextCursor: string | null;
};

export type SyncShortUrlsResult = {
	updated: number;
	deleted: number;
	remotePages: number;
	remoteReads: number;
	totalRemoteKeys: number;
};

type ShortUrlRecordInput = {
	key: string;
	url: string;
	title?: string;
	description?: string;
	tags?: string[];
	expiration: number | null;
};

type ReadShortUrlOptions = {
	localOnly?: boolean;
	hydrate?: boolean;
};

type WriteShortUrlOptions = {
	remote?: boolean;
	ifNotExists?: boolean;
};

type DeleteShortUrlOptions = {
	remote?: boolean;
};

type ShortUrlApiError = {
	error?: string;
};

const normalizeOptionalString = (value: string | undefined) => {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
};

const normalizeTags = (values: string[] | undefined) => {
	if (!values || values.length === 0) {
		return undefined;
	}

	const tags = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

	return tags.length > 0 ? tags : undefined;
};

const getMetadataMillis = (value: string, fallback: number) => {
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? fallback : parsed;
};

const getCurrentEpochSeconds = () => Math.floor(Date.now() / 1000);

const isExpiredAt = (expiration: number | null, nowEpochSeconds: number) =>
	expiration !== null && expiration <= nowEpochSeconds;

const isExpiredEntry = (entry: Pick<ShortUrlDBEntry, 'expiration'>, nowEpochSeconds: number) =>
	isExpiredAt(entry.expiration, nowEpochSeconds);

const assertBrowser = () => {
	if (!browser) {
		throw new Error('The Dexie-backed short URL wrapper is only available in the browser.');
	}

	return true;
};

const getShortUrlsTable = async () => {
	assertBrowser();

	const { shortUrlsDB } = await import('$lib/dexie/db');
	return shortUrlsDB.shortUrls;
};

const readJsonResponse = async <T>(response: Response): Promise<T> => {
	if (!response.ok) {
		let message = `Request failed with status ${response.status}.`;

		try {
			const body = (await response.json()) as ShortUrlApiError;
			if (body.error) {
				message = body.error;
			}
		} catch {
			// Ignore JSON parsing failures and fall back to the generic message.
		}

		throw new Error(message);
	}

	return (await response.json()) as T;
};

export const createShortUrlRecord = (
	input: ShortUrlRecordInput,
	now = new Date()
): ShortUrlDBEntry => {
	const nowIso = now.toISOString();
	const title = normalizeOptionalString(input.title);
	const description = normalizeOptionalString(input.description);
	const tags = normalizeTags(input.tags);

	return {
		key: input.key,
		url: input.url,
		createdAt: nowIso,
		modifiedAt: nowIso,
		expiration: input.expiration,
		...(title ? { title } : {}),
		...(description ? { description } : {}),
		...(tags ? { tags } : {})
	};
};

export const updateShortUrlRecord = (
	existing: ShortUrlDBEntry,
	updates: Partial<Omit<ShortUrlDBEntry, 'key' | 'createdAt' | 'modifiedAt'>>,
	now = new Date()
): ShortUrlDBEntry => {
	const title = normalizeOptionalString(updates.title ?? existing.title);
	const description = normalizeOptionalString(updates.description ?? existing.description);
	const tags = normalizeTags(updates.tags ?? existing.tags);

	return {
		key: existing.key,
		createdAt: existing.createdAt,
		modifiedAt: now.toISOString(),
		url: updates.url ?? existing.url,
		expiration: updates.expiration ?? existing.expiration,
		...(title ? { title } : {}),
		...(description ? { description } : {}),
		...(tags ? { tags } : {})
	};
};

export const toShortUrlMetadata = (
	entry: Pick<ShortUrlDBEntry, 'createdAt' | 'modifiedAt'>
): ShortUrlMetadata => {
	const fallback = Date.now();

	return {
		cre: getMetadataMillis(entry.createdAt, fallback),
		mod: getMetadataMillis(entry.modifiedAt, fallback)
	};
};

export const listCachedShortUrls = async (): Promise<ShortUrlDBEntry[]> => {
	if (!browser) {
		return [];
	}

	const table = await getShortUrlsTable();
	const allEntries = await table.orderBy('modifiedAt').reverse().toArray();
	const nowEpochSeconds = getCurrentEpochSeconds();
	const expiredKeys = allEntries
		.filter((entry) => isExpiredEntry(entry, nowEpochSeconds))
		.map((entry) => entry.key);

	if (expiredKeys.length > 0) {
		await table.bulkDelete(expiredKeys);
	}

	return allEntries.filter((entry) => !isExpiredEntry(entry, nowEpochSeconds));
};

export const readCachedShortUrl = async (key: string): Promise<ShortUrlDBEntry | null> => {
	if (!browser) {
		return null;
	}

	const table = await getShortUrlsTable();
	const entry = (await table.get(key)) ?? null;
	if (!entry) {
		return null;
	}

	if (isExpiredEntry(entry, getCurrentEpochSeconds())) {
		await table.delete(key);
		return null;
	}

	return entry;
};

export const upsertShortUrlInCache = async (entry: ShortUrlDBEntry): Promise<void> => {
	const table = await getShortUrlsTable();
	await table.put(entry);
};

export const upsertShortUrlsInCache = async (entries: ShortUrlDBEntry[]): Promise<void> => {
	if (entries.length === 0) {
		return;
	}

	const table = await getShortUrlsTable();
	await table.bulkPut(entries);
};

export const deleteShortUrlFromCache = async (key: string): Promise<void> => {
	const table = await getShortUrlsTable();
	await table.delete(key);
};

export const deleteShortUrlsFromCache = async (keys: string[]): Promise<void> => {
	if (keys.length === 0) {
		return;
	}

	const table = await getShortUrlsTable();
	await table.bulkDelete(keys);
};

export const listRemoteShortUrlsPage = async (cursor?: string): Promise<ListShortUrlsPage> => {
	assertBrowser();

	const searchParams = new URLSearchParams();
	if (cursor) {
		searchParams.set('cursor', cursor);
	}

	const response = await fetch(`/api/shorturls?${searchParams.toString()}`, {
		headers: {
			accept: 'application/json'
		}
	});

	return readJsonResponse<ListShortUrlsPage>(response);
};

export const readRemoteShortUrl = async (key: string): Promise<ShortUrlDBEntry | null> => {
	assertBrowser();

	const response = await fetch(`/api/shorturls?key=${encodeURIComponent(key)}`, {
		headers: {
			accept: 'application/json'
		}
	});

	if (response.status === 404) {
		return null;
	}

	const { entry } = await readJsonResponse<{ entry: ShortUrlDBEntry }>(response);
	if (isExpiredEntry(entry, getCurrentEpochSeconds())) {
		return null;
	}

	return entry;
};

export const writeRemoteShortUrl = async (
	entry: ShortUrlDBEntry,
	options: WriteShortUrlOptions = {}
): Promise<ShortUrlDBEntry> => {
	assertBrowser();

	const response = await fetch('/api/shorturls', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json'
		},
		body: JSON.stringify({
			entry,
			ifNotExists: options.ifNotExists ?? false
		})
	});

	const { entry: persistedEntry } = await readJsonResponse<{ entry: ShortUrlDBEntry }>(response);
	return persistedEntry;
};

export const deleteRemoteShortUrl = async (key: string): Promise<void> => {
	assertBrowser();

	const response = await fetch(`/api/shorturls?key=${encodeURIComponent(key)}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		let message = `Request failed with status ${response.status}.`;

		try {
			const body = (await response.json()) as ShortUrlApiError;
			if (body.error) {
				message = body.error;
			}
		} catch {
			// Ignore JSON parsing failures and fall back to the generic message.
		}

		throw new Error(message);
	}
};

export const listShortUrls = async (options: { sync?: boolean } = {}): Promise<ShortUrlDBEntry[]> => {
	if (options.sync) {
		await syncShortUrls();
	}

	return listCachedShortUrls();
};

export const readShortUrl = async (
	key: string,
	options: ReadShortUrlOptions = {}
): Promise<ShortUrlDBEntry | null> => {
	const cachedEntry = await readCachedShortUrl(key);
	if (cachedEntry || options.localOnly) {
		return cachedEntry;
	}

	const remoteEntry = await readRemoteShortUrl(key);
	if (remoteEntry && options.hydrate !== false) {
		await upsertShortUrlInCache(remoteEntry);
	}

	return remoteEntry;
};

export const writeShortUrl = async (
	entry: ShortUrlDBEntry,
	options: WriteShortUrlOptions = {}
): Promise<ShortUrlDBEntry> => {
	const persistedEntry = options.remote === false ? entry : await writeRemoteShortUrl(entry, options);
	await upsertShortUrlInCache(persistedEntry);
	return persistedEntry;
};

export const deleteShortUrl = async (
	key: string,
	options: DeleteShortUrlOptions = {}
): Promise<void> => {
	if (options.remote !== false) {
		await deleteRemoteShortUrl(key);
	}

	await deleteShortUrlFromCache(key);
};

export const syncShortUrls = async (
	options: { initialPage?: ListShortUrlsPage } = {}
): Promise<SyncShortUrlsResult> => {
	const localEntries = await listCachedShortUrls();
	const localEntriesByKey = new Map(localEntries.map((entry) => [entry.key, entry]));
	const remoteEntriesByKey = new Map<string, ShortUrlListItem>();
	const nowEpochSeconds = getCurrentEpochSeconds();

	let remotePages = 0;

	// Reuse the SSR-preloaded page when provided to skip a redundant KV list() call.
	const firstPage = options.initialPage ?? (await listRemoteShortUrlsPage());
	remotePages += 1;
	for (const item of firstPage.items) {
		remoteEntriesByKey.set(item.key, item);
	}

	let cursor = firstPage.nextCursor ?? undefined;

	while (cursor) {
		const page = await listRemoteShortUrlsPage(cursor);
		remotePages += 1;

		for (const item of page.items) {
			remoteEntriesByKey.set(item.key, item);
		}

		cursor = page.nextCursor ?? undefined;
	}

	const entriesToUpsert: ShortUrlDBEntry[] = [];
	let remoteReads = 0;

	for (const remoteEntry of remoteEntriesByKey.values()) {
		if (isExpiredAt(remoteEntry.expiration, nowEpochSeconds)) {
			continue;
		}

		const cachedEntry = localEntriesByKey.get(remoteEntry.key);
		const remoteModifiedAt = remoteEntry.metadata?.mod ?? null;
		const cachedModifiedAt = cachedEntry ? Date.parse(cachedEntry.modifiedAt) : null;
		const shouldFetch =
			!cachedEntry ||
			remoteModifiedAt === null ||
			cachedModifiedAt === null ||
			remoteModifiedAt > cachedModifiedAt ||
			remoteEntry.expiration !== cachedEntry.expiration;

		if (!shouldFetch) {
			continue;
		}

		const hydratedEntry = await readRemoteShortUrl(remoteEntry.key);
		remoteReads += 1;

		if (!hydratedEntry) {
			continue;
		}

		entriesToUpsert.push({
			...hydratedEntry,
			expiration: hydratedEntry.expiration ?? remoteEntry.expiration
		});
	}

	const keysToDelete = localEntries
		.filter((entry) => !remoteEntriesByKey.has(entry.key))
		.map((entry) => entry.key);

	await upsertShortUrlsInCache(entriesToUpsert);
	await deleteShortUrlsFromCache(keysToDelete);

	return {
		updated: entriesToUpsert.length,
		deleted: keysToDelete.length,
		remotePages,
		remoteReads,
		totalRemoteKeys: remoteEntriesByKey.size
	};
};

export type { ShortUrlDBEntry } from '$lib/types/shorturls';
