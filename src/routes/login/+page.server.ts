import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession } from '$lib/auth';
import { DURATION_MINUTES } from '$lib/auth';

export const load: PageServerLoad = async ({ locals }) => {
	// If already authenticated, redirect to root
	if (locals.user?.authenticated) {
		throw redirect(302, '/');
	}
	
	return {};
};

export const actions = {
	default: async ({ request, cookies, platform }) => {
		const data = await request.formData();
		const password = data.get('password');

		// Get the password and secret from Cloudflare environment
		const correctPassword = platform?.env.PASSWORD;
		const secret = platform?.env.SECRET;

		if (!correctPassword || !secret) {
			return fail(500, { error: 'Server configuration error. Try again in a few minutes.' });
		}

		if (password !== correctPassword) {
			return fail(401, { error: 'Invalid password' });
		}

		// Create a cryptographically signed session
		const sessionToken = await createSession(secret);

		// Set secure session cookie
		cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: DURATION_MINUTES * 60
		});

		throw redirect(303, '/');
	}
} satisfies Actions;
