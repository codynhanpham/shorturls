import { json } from '@sveltejs/kit';

import {
	deleteShortUrlFromKV,
	listShortUrlsFromKV,
	readShortUrlFromKV,
	ShortUrlConflictError,
	writeShortUrlToKV
} from '$lib/db/server';
import type { ShortUrlDBEntry } from '$lib/types/shorturls';
import type { RequestHandler } from './$types';

const getKvBinding = (platform: App.Platform | undefined) => platform?.env?.SHORT_URLS ?? null;

const isShortUrlDBEntry = (value: unknown): value is ShortUrlDBEntry => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<ShortUrlDBEntry>;

	return (
		typeof candidate.key === 'string' &&
		typeof candidate.url === 'string' &&
		typeof candidate.createdAt === 'string' &&
		typeof candidate.modifiedAt === 'string' &&
		(candidate.expiration === null || typeof candidate.expiration === 'number') &&
		(candidate.title === undefined || typeof candidate.title === 'string') &&
		(candidate.description === undefined || typeof candidate.description === 'string') &&
		(candidate.tags === undefined ||
			(Array.isArray(candidate.tags) && candidate.tags.every((tag) => typeof tag === 'string')))
	);
};

export const GET: RequestHandler = async ({ platform, url, locals }) => {
	if (!locals.user?.authenticated) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const kv = getKvBinding(platform);
	if (!kv) {
		return json(
			{ error: 'Cloudflare KV binding SHORT_URLS is not available in this environment.' },
			{ status: 500 }
		);
	}

	const key = url.searchParams.get('key')?.trim();
	if (key) {
		const entry = await readShortUrlFromKV(kv, key);
		if (!entry) {
			return json({ error: 'Short URL not found.' }, { status: 404 });
		}

		return json({ entry });
	}

	const cursor = url.searchParams.get('cursor')?.trim() || undefined;
	const page = await listShortUrlsFromKV(kv, { cursor });

	return json(page);
};

export const POST: RequestHandler = async ({ platform, request, locals }) => {
	if (!locals.user?.authenticated) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const kv = getKvBinding(platform);
	if (!kv) {
		return json(
			{ error: 'Cloudflare KV binding SHORT_URLS is not available in this environment.' },
			{ status: 500 }
		);
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const entry = (body as { entry?: unknown })?.entry;
	const ifNotExists = (body as { ifNotExists?: unknown })?.ifNotExists === true;

	if (!isShortUrlDBEntry(entry)) {
		return json({ error: 'Request body must include a valid short URL entry.' }, { status: 400 });
	}

	try {
		const persistedEntry = await writeShortUrlToKV(kv, entry, { ifNotExists });
		return json({ entry: persistedEntry });
	} catch (error) {
		if (error instanceof ShortUrlConflictError) {
			return json({ error: error.message }, { status: 409 });
		}

		console.error('Failed to persist short URL to SHORT_URLS', error);
		return json({ error: 'Failed to persist the short URL to Cloudflare KV.' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ platform, url, locals }) => {
	if (!locals.user?.authenticated) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const kv = getKvBinding(platform);
	if (!kv) {
		return json(
			{ error: 'Cloudflare KV binding SHORT_URLS is not available in this environment.' },
			{ status: 500 }
		);
	}

	const key = url.searchParams.get('key')?.trim();
	if (!key) {
		return json({ error: 'Missing short URL key.' }, { status: 400 });
	}

	try {
		await deleteShortUrlFromKV(kv, key);
		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Failed to delete short URL from SHORT_URLS', error);
		return json({ error: 'Failed to delete the short URL from Cloudflare KV.' }, { status: 500 });
	}
};