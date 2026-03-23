import type { KVNamespace } from '@cloudflare/workers-types';

import {
	toShortUrlMetadata,
	type ListShortUrlsPage,
	type ShortUrlListItem
} from '$lib/db';
import type { ShortUrlDBEntry, ShortUrlInfo, ShortUrlMetadata } from '$lib/types/shorturls';

type StoredShortUrlValue = ShortUrlInfo & {
	expiration?: number | null;
};

type KVListKey<Metadata> = {
	name: string;
	expiration?: number;
	metadata?: Metadata | null;
};

type ListShortUrlsFromKVOptions = {
	cursor?: string;
	limit?: number;
};

type WriteShortUrlToKVOptions = {
	ifNotExists?: boolean;
};

// Cache KV reads in the global network for 6 months (~180 days).
// KV values for short URLs are rarely mutated; long caching maximises read
// performance and reduces billable read operations on the free tier.
const KV_READ_CACHE_TTL_SECONDS = 60 * 60 * 24 * 180;

export class ShortUrlConflictError extends Error {
	constructor(key: string) {
		super(`Short URL \"${key}\" already exists.`);
		this.name = 'ShortUrlConflictError';
	}
}

const toStoredShortUrlValue = (entry: ShortUrlDBEntry): StoredShortUrlValue => ({
	url: entry.url,
	createdAt: entry.createdAt,
	modifiedAt: entry.modifiedAt,
	expiration: entry.expiration,
	...(entry.title ? { title: entry.title } : {}),
	...(entry.description ? { description: entry.description } : {}),
	...(entry.tags && entry.tags.length > 0 ? { tags: entry.tags } : {})
});

const toShortUrlListItem = (
	key: KVListKey<ShortUrlMetadata>
): ShortUrlListItem => ({
	key: key.name,
	expiration: key.expiration ?? null,
	metadata: key.metadata ?? null
});

export const listShortUrlsFromKV = async (
	kv: KVNamespace,
	options: ListShortUrlsFromKVOptions = {}
): Promise<ListShortUrlsPage> => {
	const result = await kv.list<ShortUrlMetadata>({
		...(options.cursor ? { cursor: options.cursor } : {}),
		...(options.limit ? { limit: options.limit } : {})
	});

	return {
		items: result.keys.map((key) => toShortUrlListItem(key)),
		listComplete: result.list_complete,
		nextCursor: result.list_complete ? null : result.cursor
	};
};

export const readShortUrlFromKV = async (
	kv: KVNamespace,
	key: string
): Promise<ShortUrlDBEntry | null> => {
	const rawValue = await kv.get(key, { cacheTtl: KV_READ_CACHE_TTL_SECONDS });
	if (rawValue === null) {
		return null;
	}

	const parsedValue = JSON.parse(rawValue) as StoredShortUrlValue;
	const { expiration = null, ...shortUrlInfo } = parsedValue;

	return {
		key,
		expiration,
		...shortUrlInfo
	};
};

export const writeShortUrlToKV = async (
	kv: KVNamespace,
	entry: ShortUrlDBEntry,
	options: WriteShortUrlToKVOptions = {}
): Promise<ShortUrlDBEntry> => {
	if (options.ifNotExists) {
		const existingValue = await kv.get(entry.key);
		if (existingValue !== null) {
			throw new ShortUrlConflictError(entry.key);
		}
	}

	await kv.put(entry.key, JSON.stringify(toStoredShortUrlValue(entry)), {
		metadata: toShortUrlMetadata(entry),
		...(entry.expiration !== null ? { expiration: entry.expiration } : {})
	});

	return entry;
};

export const deleteShortUrlFromKV = async (kv: KVNamespace, key: string): Promise<void> => {
	await kv.delete(key);
};