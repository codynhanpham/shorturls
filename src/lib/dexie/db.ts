import Dexie, { type EntityTable } from "dexie";

import type { ShortUrlDBEntry } from "$lib/types/shorturls";

type ShortUrlsDexie = Dexie & {
    shortUrls: EntityTable<ShortUrlDBEntry, "key">;
};

export const shortUrlsDB = new Dexie("shorturls") as ShortUrlsDexie;

shortUrlsDB.version(1).stores({
    shortUrls: "key, modifiedAt, expiration, *tags"
});

export type { ShortUrlDBEntry } from "$lib/types/shorturls";