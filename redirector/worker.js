const BASE = 'codynhanpham.com';

/**
 * Helper to swap the host to the base domain
 * Keeps the original protocol (http/https) in the request
 * The BASE host will handle upgrading to https as needed
 */
function buildURL(urlStr) {
    const urlObject = new URL(urlStr);
    urlObject.host = BASE;
    return urlObject.toString();
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);

        // If it's the root or a nested path (e.g., /a/b), redirect to the base site
        if (pathParts.length !== 1) {
            return Response.redirect(buildURL(request.url), 301);
        }

        const key = pathParts[0];

        try {
            const result = await env.SHORT_URLS.get(key, {
                type: "json",
                cacheTtl: 60 * 60 * 24 * 30
            });

            if (result && result.url) {
                return Response.redirect(result.url.trim(), 301);
            }

            // If key doesn't exist or is malformed, fall back to base URL
            return Response.redirect(buildURL(request.url), 301);

        } catch (e) {
            console.error(`Worker Error: ${e.message}`);
            // Fail-safe: Redirect to base domain on KV or execution errors
            // Most of the time, this is probably due to reaching KV free limits
            return Response.redirect(buildURL(request.url), 302);
        }
    }
};