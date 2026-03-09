import Dexie, { type EntityTable } from "dexie"


export type ShortUrlDBEntry = {
    key: string; // The short URL key
    url: string; // The original long URL
    createdAt: string; // Creation date as ISO string
    modifiedAt: string; // Last modified date as ISO string
    title?: string; // Optional title of the webpage at the URL
    description?: string; // Optional description of the webpage at the URL
    tags?: string[]; // Optional array of tags associated with the URL

    // https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys
    expiration: number | null; // Expiration timestamp in seconds since epoch (to match KV specs), or null if it never expires
}