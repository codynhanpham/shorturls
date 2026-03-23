<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';

	import { readCachedShortUrl, readShortUrl, syncShortUrls } from '$lib/db';
	import type { PageProps } from './$types';

	const LAST_SYNC_AT_KEY = 'shorturls:lastSyncAtMs';
	const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

	let { data }: PageProps = $props();

	let statusMessage = $state('Checking local cache...');

	const fallbackPath = $derived(data.user?.authenticated ? '/' : '/login');

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

	const asUrl = (value: string) => {
		const trimmedValue = value.trim();
		if (!trimmedValue) {
			return null;
		}

		try {
			return new URL(trimmedValue);
		} catch {
			try {
				return new URL(`https://${trimmedValue}`);
			} catch {
				return null;
			}
		}
	};

	const isSameHostname = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

	const buildExternalFallbackUrl = (pathname: string, search: string) => {
		const fallbackBaseUrl = asUrl(env.PUBLIC_REDIRECT_FALLBACK_BASE ?? '');
		const publicHostUrl = asUrl(env.PUBLIC_HOSTNAME ?? '');

		if (!fallbackBaseUrl || !publicHostUrl) {
			return null;
		}

		if (isSameHostname(fallbackBaseUrl.hostname, publicHostUrl.hostname)) {
			return null;
		}

		const resolvedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
		const basePathname = fallbackBaseUrl.pathname.endsWith('/')
			? fallbackBaseUrl.pathname.slice(0, -1)
			: fallbackBaseUrl.pathname;

		fallbackBaseUrl.pathname = `${basePathname}${resolvedPathname}`;
		fallbackBaseUrl.search = search;
		fallbackBaseUrl.hash = '';

		return fallbackBaseUrl.toString();
	};

	const redirectToFallback = () => {
		const externalFallbackUrl = buildExternalFallbackUrl(data.requestPathname, data.requestSearch);
		if (externalFallbackUrl) {
			window.location.replace(externalFallbackUrl);
			return;
		}

		window.location.replace(fallbackPath);
	};

	const resolveAndRedirect = async () => {
		const key = data.shortPath.split('/').find(Boolean)?.trim() ?? '';
		if (!key) {
			redirectToFallback();
			return;
		}

		const cachedEntry = await readCachedShortUrl(key);
		if (cachedEntry) {
			window.location.replace(cachedEntry.url);
			return;
		}

		const now = Date.now();
		const lastSyncAt = readLastSyncAtMs();
		const shouldSync =
			lastSyncAt === null || now - lastSyncAt >= BACKGROUND_SYNC_INTERVAL_MS;

		if (shouldSync) {
			statusMessage = 'Refreshing cache from Cloudflare KV...';
			try {
				await syncShortUrls();
				writeLastSyncAtMs(Date.now());
			} catch (error) {
				console.error('Failed to sync short URLs before redirect lookup', error);
			}

			const syncedEntry = await readCachedShortUrl(key);
			if (syncedEntry) {
				window.location.replace(syncedEntry.url);
				return;
			}
		}

		statusMessage = 'Checking Cloudflare KV...';
		try {
			const remoteEntry = await readShortUrl(key, { hydrate: true });
			if (remoteEntry) {
				window.location.replace(remoteEntry.url);
				return;
			}
		} catch (error) {
			console.error('Failed to resolve short URL from Cloudflare KV', error);
		}

		redirectToFallback();
	};

	onMount(() => {
		void resolveAndRedirect();
	});
</script>

<main class="min-h-screen flex items-center justify-center p-6">
	<p class="text-sm text-muted-foreground">{statusMessage}</p>
</main>
