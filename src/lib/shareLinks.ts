export function createLookbookShareUrl(lookId: string, origin: string): string {
  const url = new URL('/', origin);
  url.searchParams.set('look', lookId);
  return url.toString();
}

export function createProductShareUrl(productId: string, origin: string): string {
  const url = new URL('/', origin);
  url.searchParams.set('view', 'collections');
  url.searchParams.set('product', productId);
  return url.toString();
}
