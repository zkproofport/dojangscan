export function localURL(params: Record<string, string>) {
  const source = new URLSearchParams(window.location.search).get("source");
  return (
    window.location.pathname +
    "?" +
    new URLSearchParams({
      ...(source === "public" || source === "backend" ? { source } : {}),
      ...params,
    }).toString()
  );
}
export function shareURL(params: Record<string, string>) {
  return new URL(localURL(params), window.location.origin).href;
}
