import type { Handle } from '@sveltejs/kit';
import { verifySession, createSession, DURATION_MINUTES } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Check if user has a valid session cookie
	const sessionToken = event.cookies.get('session');
	const secret = event.platform?.env.SECRET;
	
	if (sessionToken && secret && await verifySession(sessionToken, secret)) {
		event.locals.user = {
			authenticated: true
		};
		// Renew the session on every authenticated request (sliding window)
		const renewedToken = await createSession(secret);
		event.cookies.set('session', renewedToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: DURATION_MINUTES * 60
		});
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
