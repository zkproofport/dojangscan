import { createBackendClient, backendPage } from "./backend-api";
import production from "../deployment/public-explorer.json";
export function chooseDataSource(
  defaultSource: string | undefined,
  search: string,
) {
  const selected = new URLSearchParams(search).get("source");
  return selected === "backend" || selected === "public"
    ? selected
    : defaultSource === "backend"
      ? "backend"
      : "public";
}
const env = import.meta.env ?? {};
export const backendEnabled =
  chooseDataSource(
    env.VITE_DOJANGSCAN_SOURCE ?? production.defaultSource,
    typeof window === "undefined" ? "" : window.location.search,
  ) === "backend";
export const backendNetwork = env.VITE_DOJANGSCAN_NETWORK ?? (env.PROD ? production.network : "");
export function queryBackend(kind: string, params: Record<string, string>) {
  const client = createBackendClient(backendNetwork);
  if (kind === "backend-status") return client.status();
  if (kind === "backend-detail") return client.detail(params.uid);
  if (kind === "backend-history") return client.history(params.uid);
  if (kind === "backend-list") {
    const { cursor, limit, ...filters } = params;
    return backendPage(client, filters, cursor, limit ? Number(limit) : 20);
  }
  throw new Error("Unsupported Backend endpoint");
}
