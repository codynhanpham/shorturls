import { fail } from '@sveltejs/kit';

import { createShortUrlRecord } from '$lib/db';
import { ShortUrlConflictError, writeShortUrlToKV } from '$lib/db/server';
import type { Actions, PageServerLoad } from './$types';



type CreateShortUrlFields = {
	url: string;
	key: string;
	title: string;
	description: string;
	tags: string[];
	isEphemeral: boolean;
	expiration: string;
};

type CreateShortUrlFieldErrors = Partial<Record<'url' | 'key' | 'expiration', string>>;

const MINIMUM_EXPIRATION_MINUTES = 5;

const emptyCreateShortUrlFields = (): CreateShortUrlFields => ({
	url: '',
	key: '',
	title: '',
	description: '',
	tags: [],
	isEphemeral: false,
	expiration: ''
});

const asTrimmedString = (value: FormDataEntryValue | null) =>
	typeof value === 'string' ? value.trim() : '';

const normalizeUrl = (value: string) => {
	if (!value) {
		return null;
	}

	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return null;
		}

		return url.toString();
	} catch {
		return null;
	}
};

const normalizeKey = (value: string) => {
	if (value.includes('/')) {
		return null;
	}

	const normalized = value.trim();

	return normalized || null;
};

const normalizeOptionalString = (value: string) => value || undefined;

const normalizeTags = (values: FormDataEntryValue[]) => {
	const tags = values
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.trim())
		.filter(Boolean);

	return Array.from(new Set(tags));
};

const parseExpiration = (value: string, isEphemeral: boolean) => {
	if (!isEphemeral) {
		return { expiration: null as number | null, error: null as string | null };
	}

	if (!value) {
		return { expiration: null, error: 'Choose an expiration date and time.' };
	}

	const parsedTimestamp = Date.parse(value);
	if (Number.isNaN(parsedTimestamp)) {
		return { expiration: null, error: 'Expiration date is invalid.' };
	}

	if (parsedTimestamp - Date.now() < MINIMUM_EXPIRATION_MINUTES * 60 * 1000) {
		return {
			expiration: null,
			error: `Expiration must be at least ${MINIMUM_EXPIRATION_MINUTES} minutes in the future.`
		};
	}

	return {
		expiration: Math.floor(parsedTimestamp / 1000),
		error: null as string | null
	};
};

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.SHORT_URLS;

	if (!kv) {
		return {
			kvError: 'Cloudflare KV binding SHORT_URLS is not available in this environment.'
		};
	}

	return { kvError: null };
};

export const actions: Actions = {
	default: async ({ platform, request, locals }) => {
		if (!locals.user?.authenticated) {
			return fail(401, { error: 'Unauthorized.', fields: emptyCreateShortUrlFields(), fieldErrors: {} });
		}
		const kv = platform?.env?.SHORT_URLS;
		const formData = await request.formData();

		const fields: CreateShortUrlFields = {
			url: asTrimmedString(formData.get('url')),
			key: asTrimmedString(formData.get('key')),
			title: asTrimmedString(formData.get('title')),
			description: asTrimmedString(formData.get('description')),
			tags: normalizeTags(formData.getAll('tags')),
			isEphemeral: asTrimmedString(formData.get('isEphemeral')) === 'true',
			expiration: asTrimmedString(formData.get('expiration'))
		};

		if (!kv) {
			return fail(500, {
				error: 'Cloudflare KV binding SHORT_URLS is not available in this environment.',
				fields,
				fieldErrors: {}
			});
		}

		const fieldErrors: CreateShortUrlFieldErrors = {};
		const normalizedUrl = normalizeUrl(fields.url);
		const normalizedKey = normalizeKey(fields.key);
		const { expiration, error: expirationError } = parseExpiration(
			fields.expiration,
			fields.isEphemeral
		);

		if (!normalizedUrl) {
			fieldErrors.url = 'Enter a valid http:// or https:// URL.';
		}

		if (!normalizedKey) {
			fieldErrors.key = 'Key must not be empty or contain slashes.';
		}

		if (expirationError) {
			fieldErrors.expiration = expirationError;
		}

		if (Object.keys(fieldErrors).length > 0) {
			return fail(400, {
				error: 'Please correct the highlighted fields and try again.',
				fields,
				fieldErrors
			});
		}

		try {
			const createdEntry = createShortUrlRecord({
				key: normalizedKey!,
				url: normalizedUrl!,
				title: normalizeOptionalString(fields.title),
				description: normalizeOptionalString(fields.description),
				tags: fields.tags,
				expiration
			});

			await writeShortUrlToKV(kv, createdEntry, { ifNotExists: true });

			return {
				success: true,
				message: `Created /${normalizedKey!}`,
				fields: emptyCreateShortUrlFields(),
				fieldErrors: {},
				createdEntry
			};
		} catch (error) {
			if (error instanceof ShortUrlConflictError) {
				return fail(409, {
					error: 'That short URL key is already in use.',
					fields,
					fieldErrors: {
						key: 'This short URL already exists. Choose another key.'
					}
				});
			}

			console.error('Failed to create KV record in SHORT_URLS', error);

			return fail(500, {
				error: 'Failed to create the short URL in Cloudflare KV.',
				fields,
				fieldErrors: {}
			});
		}
	}
};