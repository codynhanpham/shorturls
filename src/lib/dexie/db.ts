import Dexie, { type EntityTable } from "dexie"


export type ShortUrlDBEntry = {
    key: string; // The short URL key
    url: string; // The original long URL
    createdAt: string; // Creation date as ISO string
    modifiedAt: string; // Last modified date as ISO string
}