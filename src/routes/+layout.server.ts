import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Allow access to login and logout pages without auth
	if (url.pathname === '/login' || url.pathname === '/logout') {
		return {
			user: locals.user
		};
	}
	
	// Check if user is authenticated for all other routes
	if (!locals.user?.authenticated) {
		throw redirect(302, '/login');
	}
	
	return {
		user: locals.user
	};
};
