// Relative to the document, so both user pages and /repository/ project pages work.
export const assetUrl = (path: string) => new URL(path.replace(/^\/+/, ""), document.baseURI).href;
