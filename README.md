# Short URLs

A URL shortener built with SvelteKit for deploying on Cloudflare Workers.

This project uses Cloudflare's Workers KV for persistent storage, and Dexie.js for client-side IndexedDB management to reduce loads and usages (thus, cost) on the Workers KV store.

## How it works
There are two main components in this project:
1. The URL Shortener UI for managing shortened URLs and interacting with the Workers KV store
2. The Redirector Worker that intercepts incoming requests to shortened URLs and performs the redirection.

### URL Shortener UI
This is the web interface for managing shortened URLs and interacting with the KV store.

As Cloudflare KV has [limits](https://developers.cloudflare.com/kv/platform/pricing/) on the number of operations per day on their free tier, the UI uses IndexedDB as a local cache to minimize the number of KV operations. In addition, some design decisions are made to reduce the number of KV operations as much as possible.

Every record will have an associated metadata that tracks the last modified timestamp. While its maximum size is only 1024 bytes, this metadata is "free" in a sense, as it is returned along with the record during a `list()` without costing any `read()` operations. At the start of any fresh session, only single `list()` operation is used to fetch the existing shortened URL records and compare against the local IndexedDB cache. If significant differences are detected (e.g., new records, or records with newer timestamps), the local IndexedDB will be updated accordingly. Removed records are deleted from the local IndexedDB without needing further KV operations.

After that, most operations are performed on the local IndexedDB, and synching only happens on request (e.g., when a new URL is shortened, or an existing one is modified/deleted).

If there are more than 1000 records (the maximum number of records that can be returned by a single `list()` operation), only the first 1000 records will be automatically fetched on the initial load. To view the rest of the records, manual pagination is required (i.e., clicking the "Load More" button at the bottom of the list) to trigger additional `list()` operations with the appropriate `cursor` parameter.

A `Synchronize` button is also provided to allow users to manually trigger a full synchronization between the local IndexedDB and the Workers KV store.

### Redirector Worker
The redirector worker binds to the same KV namespace as the URL Shortener UI and performs a lookup for the incoming request path. If a matching record is found, it issues a 301 redirect to the corresponding URL. Otherwise, it will fallback with a 302 redirect to a default BASE host with the same original path.

If both the URL Shortener UI and the Redirector Worker are deployed to the same route (typically, the UI on the root path, and the Redirector Worker on a wildcard path of `/*`), the same Worker can handle both the management of shortened URLs and the redirection logic. However, if the UI and the Redirector Worker are to be deployed separately, see [`./redirector`](./redirector/README.md) for more information.


## Future Improvements
- To further reduce the number of KV operations especially when initializing the local IndexedDB cache on a new device, perhaps a `Share...` button should be added that display a link + QR code to connect the new device with the sharing one via WebRTC or similar peer-to-peer communication protocol, and then the local IndexedDB cache can be transferred directly between devices without needing to fetch from the Workers KV store at all.


## Deployment
TBA


