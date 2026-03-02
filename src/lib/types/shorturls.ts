export type ShortUrlInfo = {
    url: string; // The full URL that the short URL redirects to
    createdAt: string; // The UTC timestamp when the short URL was created
    modifiedAt: string; // The UTC timestamp when the short URL was last modified
}
export type ShortUrlMetadata = {
    cre: number; // Creation UTC timestamp in milliseconds since epoch
    mod: number; // Last modification UTC timestamp in milliseconds since epoch
}
