import { test } from "node:test";
import assert from "node:assert/strict";
import { apiBase } from "../lib/api-endpoints";
import { createBackendClient } from "../lib/backend-api";
import { createHistoricalClient } from "../lib/historical-api";
test("API bases support HTTPS gateway paths and explicit same-origin reverse proxies", () => {
  assert.equal(apiBase(undefined, "/api/dojangscan"), "/api/dojangscan");
  assert.equal(
    apiBase("https://api.example.com/live/", ""),
    "https://api.example.com/live",
  );
  assert.equal(apiBase("/live/", ""), "/live");
  for (const v of [
    "http://api.example.com",
    "https://user:password@api.example.com",
    "https://api.example.com?key=x",
    "//api.example.com",
    "/../ops",
    "/live?secret=x",
  ])
    assert.throws(() => apiBase(v, ""));
});
test("both clients preserve paths and cursors at configured gateway without credentials", async () => {
  const urls: string[] = [];
  const request: typeof fetch = async (input, init) => {
    urls.push(String(input));
    assert.equal(init?.credentials, "omit");
    return new Response(
      JSON.stringify({
        meta: { network: "giwa-sepolia-catchup25-r1", chainId: "91342" },
        data: [],
        next: null,
      }),
    );
  };
  await createBackendClient(
    "giwa-sepolia-catchup25-r1",
    request,
    "https://api.example.com/live",
  ).list({}, "opaque+/=");
  await createHistoricalClient(
    "giwa-sepolia-catchup25-r1",
    request,
    "https://api.example.com/history",
  ).events({}, "opaque+/=");
  assert.match(urls[0]!, /^https:\/\/api.example.com\/live\/v1\/networks\//);
  assert.equal(new URL(urls[0]!).searchParams.get("cursor"), "opaque+/=");
  assert.match(
    urls[1]!,
    /\/history\/v1\/networks\/giwa-sepolia-catchup25-r1\/historical\/events/,
  );
});
