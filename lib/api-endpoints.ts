/** Public build settings contain URLs only, never credentials. Pages has no API proxy. */
export function apiBase(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[?#\\]/.test(value) &&
    !value.includes("..")
  )
    return value.replace(/\/$/, "");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /[\\]/.test(value)
  )
    throw new Error("API_BASE_REQUIRES_CREDENTIAL_FREE_HTTPS");
  return url.href.replace(/\/$/, "");
}
const env = import.meta.env ?? {};
export const liveAPIBase = apiBase(
  env.VITE_DOJANGSCAN_API_BASE,
  "/api/dojangscan",
);
export const historicalAPIBase = apiBase(
  env.VITE_DOJANGSCAN_HISTORY_API_BASE,
  "/api/historical",
);
