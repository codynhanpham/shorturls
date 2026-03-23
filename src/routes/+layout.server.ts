import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, route, url }) => {
	// Public routes should remain accessible without auth.
	if (url.pathname === '/login' || url.pathname === '/logout') {
		return {
			user: locals.user
		};
	}

	// Route-group IDs preserve the source route hierarchy, which lets us
	// enforce auth only for dashboard/app pages while keeping /[short] public.
	const isAppRoute = route.id?.startsWith('/(app)') ?? false;
	if (isAppRoute && !locals.user?.authenticated) {
		throw redirect(302, '/login');
	}

	return {
		user: locals.user
	};
};
