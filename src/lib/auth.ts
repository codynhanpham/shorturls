export const DURATION_MINUTES = 4 * 60;

/**
 * Secure session management using HMAC-SHA256 signatures
 */

// Create a signed session token
export async function createSession(secret: string): Promise<string> {
	const timestamp = Date.now();
	const data = `authenticated:${timestamp}`;
	const signature = await sign(data, secret);
	return `${data}.${signature}`;
}

// Verify a signed session token
export async function verifySession(token: string, secret: string): Promise<boolean> {
	try {
		const parts = token.split('.');
		if (parts.length !== 2) return false;

		const [data, signature] = parts;
		
		// Check if signature is valid
		const expectedSignature = await sign(data, secret);
		if (signature !== expectedSignature) return false;

		// Check if session hasn't expired
		const timestamp = parseInt(data.split(':')[1]);
		const age = Date.now() - timestamp;
		const maxAge = DURATION_MINUTES * 60 * 1000;
		
		return age < maxAge;
	} catch {
		return false;
	}
}

// HMAC-SHA256 signing using Web Crypto API
async function sign(data: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(data);

	// Import the secret key
	const key = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	// Sign the data
	const signature = await crypto.subtle.sign('HMAC', key, messageData);

	// Convert to hex string
	return Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
