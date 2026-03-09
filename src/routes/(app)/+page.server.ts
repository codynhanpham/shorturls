import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.SHORT_URLS;

	if (!kv) {
		return {
			kvKeys: [],
			listComplete: true,
			nextCursor: null,
			kvError: 'Cloudflare KV binding SHORT_URLS is not available in this environment.'
		};
	}

	try {
		const result = await kv.list();

		return {
			kvKeys: result.keys.map((key) => ({
				name: key.name,
				expiration: key.expiration ?? null,
				metadata: key.metadata ?? null
			})),
			listComplete: result.list_complete,
			nextCursor: result.list_complete ? null : result.cursor,
			kvError: null
		};
	} catch (error) {
		console.error('Failed to list KV keys from SHORT_URLS', error);

		return {
			kvKeys: [],
			listComplete: true,
			nextCursor: null,
			kvError: 'Failed to list keys from Cloudflare KV.'
		};
	}
};