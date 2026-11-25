import production from "../deployment/public-explorer.json";
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
export function apiDefaults(isProduction: boolean) {
  return isProduction
    ? { live: production.liveAPIBase, history: production.historicalAPIBase }
    : { live: "/api/dojangscan", history: "/api/historical" };
}
const defaults = apiDefaults(env.PROD === true);
export const liveAPIBase = apiBase(env.VITE_DOJANGSCAN_API_BASE, defaults.live);
export const recentAPIBase = apiBase(
  env.VITE_DOJANGSCAN_RECENT_API_BASE,
  env.PROD === true
    ? production.liveAPIBase.replace(/\/live$/, "/recent")
    : "/api/recent",
);
export const historicalAPIBase = apiBase(
  env.VITE_DOJANGSCAN_HISTORY_API_BASE,
  defaults.history,
);
