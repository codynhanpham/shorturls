// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import { KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				authenticated: boolean;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				SHORT_URLS: KVNamespace;
				PASSWORD: string;
				SECRET: string;
			};
		}
	}
}

export {};
