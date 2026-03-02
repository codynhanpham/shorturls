import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
	default: async ({ cookies }) => {
		// Clear the session cookie
		cookies.delete('session', { path: '/' });
		
		throw redirect(303, '/login');
	}
} satisfies Actions;
