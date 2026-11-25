import { NETWORK } from './giwa';

/** Development transport only. Public API identity and all query parameters stay unchanged. */
export function publicReadURL(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const target = new URL(url, NETWORK.explorer);
  if (target.origin !== new URL(NETWORK.explorer).origin ||
      target.username || target.password || !target.pathname.startsWith('/api/v2/')) return url;
  return `/api/public-explorer${target.pathname}${target.search}`;
}
