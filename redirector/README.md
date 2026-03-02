# Redirect Worker

This is the worker that will intercept requests to the shortened URLs and redirect to the original URLs. It binds to the same KV namespace as the main URL Shortener interface and uses the same data store for URL mappings.

If the main URL Shortener web interface is deployed on the same host (domain/subdomain) as the shortened domain, the same worker can handle both the web interface and the redirect functionality. You are all set!

However, if the main URL Shortener web interface is on a different host (domain/subdomain) than the shortened domain (e.g., the web interface is on `shortener.example.com` and you want to handle shortened URLs on `example.com`), the easiest way is to deploy a separate redirect worker on the shortened domain (e.g., `example.com`) and bind it to the same KV namespace.

On the Cloudflare dashboard, you can create a new worker for the redirector and bind it to the same KV namespace as the main URL Shortener. Then, simply copy the code from [`./worker.js`](./worker.js) into the new worker's script editor. Make sure to also set up the appropriate route for the redirect worker (e.g., `example.com/*`) so that it can intercept requests to the shortened URLs.

The redirector worker code is unlikely to change as it only reads from the KV store and performs redirects, so manual deployment shouldn't be too much of a hassle...