import type { Handle } from '@sveltejs/kit';
import { verifySession } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Check if user has a valid session cookie
	const sessionToken = event.cookies.get('session');
	const secret = event.platform?.env.SECRET;
	
	if (sessionToken && secret && await verifySession(sessionToken, secret)) {
		event.locals.user = {
			authenticated: true
		};
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
