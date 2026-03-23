import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = ({ params, url }) => {
	return {
		shortPath: params.short ?? '',
		requestPathname: url.pathname,
		requestSearch: url.search
	};
};
