import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  recordSources,
  recordSource,
  sourceURL,
  addressURL,
  sourceLabel,
  needsPublicOverview,
  eventQuery,
  eventRecordFacts,
  writeRoute,
} from "../lib/record-navigation";
import { resolveProductLookup } from "../lib/product-experience";
import { AddressIdentity } from "../components/explorer-presentation";
import { RecordOverview } from "../components/record-context";
import SourceContext from "../components/source-context";
import ToolDirectory from "../components/tool-directory";
import PrimaryNavigation from "../components/primary-navigation";
import HistoricalExplorer from "../components/historical-explorer";
import type { HistoricalPage } from "../lib/historical-api";
const uid = "0x" + "a".repeat(64),
  address = "0x" + "b".repeat(40),
  schema = "0x" + "c".repeat(64);
const parse = (s: string) => new URL(s, "https://dojangscan.com").searchParams;

test("same UID is explicit in all four scopes, with no transferred snapshot cursor", () => {
  for (const source of recordSources) {
    const q = parse(
      sourceURL(
        source,
        `?uid=${uid}&schema=${schema}&cursor=old&detailCursor=old&history=recent&source=backend`,
      ),
    );
    assert.equal(q.get("uid"), uid);
    assert.equal(recordSource("?" + q), source);
    assert.equal(q.has("cursor"), false);
    assert.equal(q.has("detailCursor"), false);
    assert.notEqual(sourceLabel(source, true), sourceLabel(source, false));
  }
});
test("recipient and issuer context survives explicit source changes and address clicks", () => {
  for (const role of ["issuer", "recipient"] as const)
    for (const source of recordSources) {
      const q = parse(addressURL(address, role, source));
      assert.equal(
        q.get(source === "public" && role === "recipient" ? "address" : role),
        address,
      );
      assert.equal(q.has(role === "issuer" ? "recipient" : "issuer"), false);
      assert.equal(recordSource("?" + q), source);
    }
  const q = parse(
    sourceURL("recent", `?view=wallet&source=public&address=${address}`),
  );
  assert.equal(q.get("recipient"), address);
  const html = renderToStaticMarkup(
    createElement(AddressIdentity, {
      value: address,
      role: "issuer",
      source: "recent",
    }),
  );
  assert.match(html, /history=recent/);
  assert.match(html, /issuer=/);
  assert.match(html, /외부에서 보기/);
  assert.match(html, /target="_blank"/);
});
test("legacy direct URLs keep their original meaning", () => {
  for (const [query, source] of [
    ["view=wallet", "public"],
    ["view=issuer", "public"],
    ["view=recipient-records", "live"],
    ["view=issuer-records", "live"],
    ["view=explore&source=public", "public"],
    ["view=explore&source=backend", "live"],
    ["view=explore&source=backend&history=recent", "recent"],
    ["view=explore&source=backend&history=backfill", "history"],
  ])
    assert.equal(recordSource("?" + query), source);
  for (const suffix of [
    "",
    "&source=backend",
    "&source=backend&history=backfill",
    "&source=backend&history=recent",
  ])
    assert.equal(
      parse(
        resolveProductLookup(
          `https://dojangscan.com/?uid=${uid}${suffix}`,
          "record",
          "recent",
        )!.href,
      ).get("uid"),
      uid,
    );
});
test("recent search is identity-first and preserves filters without querying another source", () => {
  assert.deepEqual(
    eventQuery(uid.toUpperCase().replace("0X", "0x"), "recipient", {}),
    { kind: "uid", uid },
  );
  assert.deepEqual(
    eventQuery(address, "issuer", {
      recipient: address,
      event: "Revoked",
      schema,
    }),
    { kind: "filters", filters: { issuer: address, event: "Revoked", schema } },
  );
  assert.deepEqual(eventQuery("", "recipient", { event: "Attested" }), {
    kind: "filters",
    filters: { event: "Attested" },
  });
  for (const value of ["0x123", "not-a-record", "https://evil.test"])
    assert.equal(eventQuery(value, "recipient", {}).kind, "invalid");
  assert.equal(
    parse(resolveProductLookup(uid, "record", "recent")!.href).get("history"),
    "recent",
  );
});
test("guide, tools, home, Proof Studio and direct address pages do not request Public overview", () => {
  for (const view of [
    "home",
    "tools",
    "guide",
    "brand",
    "lab",
    "wallet",
    "issuer",
    "codes",
    "recipient-records",
    "issuer-records",
  ])
    for (const backend of [true, false])
      assert.equal(needsPublicOverview(view, backend), false, view);
  assert.equal(needsPublicOverview("explore", true), false);
  assert.equal(needsPublicOverview("explore", false), true);
  assert.equal(needsPublicOverview("issuers", false), true);
  assert.equal(needsPublicOverview("explore", false, "?uid=" + uid), false);
});
test("event summary uses only linked issuance evidence and does not invent time or current state", () => {
  const page = {
    meta: {
      network: "test",
      snapshot: "x",
      observedAt: "2026-11-25T00:00:00Z",
    },
    data: [
      { uid, event: "Attested", schema, issuer: address, recipient: address },
    ],
    next: null,
  } as HistoricalPage;
  assert.deepEqual(eventRecordFacts(page, uid), {
    schema,
    issuer: address,
    recipient: address,
    issuedAt: null,
  });
  assert.equal(eventRecordFacts(page, "0x" + "f".repeat(64)).issuer, null);
  assert.equal(
    eventRecordFacts(
      { ...page, data: [{ ...page.data[0], event: "Revoked" }] },
      uid,
    ).issuer,
    null,
  );
  const html = renderToStaticMarkup(
    createElement(RecordOverview, {
      ...eventRecordFacts(page, uid),
      uid,
      source: "Recent",
      fields: [{ name: "day", value: "20261116" }],
    }),
  );
  assert.ok(html.indexOf("20261116") < html.indexOf("record-parties"));
  assert.match(html, /시각 미확인/);
  assert.doesNotMatch(html, /자격 승인|2026-11-16/);
});
function withLocation(query: string, work: () => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
    previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  const target = new EventTarget();
  let index = 0;
  const stack = [new URL(query, "https://dojangscan.com/")];
  const mock = Object.assign(target, {
    history: {
      pushState(_state: unknown, _unused: string, u: string | URL) {
        stack.splice(++index);
        stack.push(new URL(String(u), stack[index - 1]));
      },
      replaceState(_state: unknown, _unused: string, u: string | URL) {
        stack[index] = new URL(String(u), stack[index]);
      },
      back() {
        if (index > 0) index--;
      },
      forward() {
        if (index + 1 < stack.length) index++;
      },
    },
  });
  Object.defineProperty(mock, "location", { get: () => stack[index] });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mock,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    get: () => stack[index],
  });
  try {
    work();
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousLocation)
      Object.defineProperty(globalThis, "location", previousLocation);
    else Reflect.deleteProperty(globalThis, "location");
  }
}
test("navigation keeps distinct list/filter/detail history; back and forward restore exact query context", () => {
  withLocation("?view=explore&source=backend&history=recent", () => {
    writeRoute(
      `?view=explore&source=backend&history=recent&issuer=${address}&event=Revoked`,
    );
    writeRoute(
      `?view=explore&source=backend&history=recent&issuer=${address}&event=Revoked&uid=${uid}&detailCursor=page2`,
    );
    window.history.back();
    assert.equal(parse(location.href).get("uid"), null);
    assert.equal(parse(location.href).get("issuer"), address);
    window.history.forward();
    assert.equal(parse(location.href).get("uid"), uid);
    assert.equal(parse(location.href).get("detailCursor"), "page2");
    writeRoute(
      `?event=Revoked&issuer=${address}&source=backend&view=explore&uid=${uid}&history=recent&detailCursor=page2`,
    );
    window.history.back();
    assert.equal(parse(location.href).get("uid"), null);
    assert.throws(
      () => writeRoute("https://evil.test"),
      /LOCAL_ROUTE_REQUIRED/,
    );
  });
});
test("source alternatives open separately and retain subject without a silent fallback", () =>
  withLocation(`?view=explore&source=backend&history=recent&uid=${uid}`, () => {
    const html = renderToStaticMarkup(
      createElement(SourceContext, { uid, source: "recent" }),
    );
    assert.equal((html.match(/<option /g) ?? []).length, 4);
    assert.match(html, /value="recent" selected/);
    assert.match(html, /다른 출처 조회 · 새 탭/);
    assert.doesNotMatch(html, /<details/);
  }));
test("four main actions and specialist tools remain reachable without a source selector", () =>
  withLocation("?view=home", () => {
    const html = renderToStaticMarkup(
      createElement(PrimaryNavigation, {
        view: "home",
        backend: false,
        search: "",
        ko: true,
      }),
    );
    const nav = html.match(/<nav aria-label="주요 메뉴">([\s\S]*?)<\/nav>/)![1];
    assert.equal((nav.match(/<a /g) ?? []).length, 4);
    for (const label of ["도장 조회", "주소 조회", "발급·관리", "전문 도구"])
      assert.ok(nav.includes(label));
    const tools = renderToStaticMarkup(createElement(ToolDirectory));
    for (const href of [
      "view=codes",
      "view=schemas",
      "view=lab",
      "tool=console",
      "history=backfill",
      "view=guide",
    ])
      assert.ok(tools.includes(href));
  }));
test("Unconfirmed Recent has one basic search, expandable filters and no false official status", () =>
  withLocation(
    "?view=explore&source=backend&history=recent&catalog=unconfirmed",
    () => {
      const html = renderToStaticMarkup(
        createElement(HistoricalExplorer, { recent: true }),
      );
      assert.equal((html.match(/<form /g) ?? []).length, 1);
      assert.match(html, /event-advanced/);
      assert.doesNotMatch(html, /<datalist|explorer-search-types/);
      assert.match(html, /Dojang 분류 미확인/);
      assert.doesNotMatch(html, /Current Decision|로그 발견 ≠|공식 도장/);
      assert.match(html, /새로고침/);
    },
  ));

test("pasted address shares keep issuer/recipient purpose and explicit source", () => {
  for (const role of ["issuer", "recipient"] as const)
    for (const source of recordSources) {
      const share = new URL(
        addressURL(address, role, source),
        "https://dojangscan.com",
      ).href;
      const target = resolveProductLookup(share, "record", "recent")!;
      assert.equal(recordSource(target.href), source);
      assert.equal(
        parse(target.href).get(
          source === "public" && role === "recipient" ? "address" : role,
        ),
        address,
      );
    }
});
test("English navigation keeps the same four actions and current source", () => {
  const html = renderToStaticMarkup(
    createElement(PrimaryNavigation, {
      view: "explore",
      backend: true,
      search: "?source=backend&history=recent",
      ko: false,
    }),
  );
  for (const text of [
    "Dojang lookup",
    "Address lookup",
    "Issue &amp; manage",
    "Tools",
  ])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(html, /aria-current="page"[^>]*>[\s\S]*?Tools/);
});

test("long identifiers remain available behind details instead of dominating recorded content", () => {
  const html = renderToStaticMarkup(
    createElement(RecordOverview, {
      uid,
      source: "Public",
      schema,
      issuer: address,
      recipient: address,
      issuedAt: null,
      fields: [
        { name: "runner", type: "bytes32", value: uid },
        { name: "day", value: "20261116" },
      ],
    }),
  );
  const content = html.slice(
    html.indexOf("record-content"),
    html.indexOf("record-parties"),
  );
  assert.ok(content.indexOf("20261116") < content.indexOf("<details"));
  assert.ok(content.indexOf(uid) > content.indexOf("<details"));
});

test("Recent without a classified UID contract explains the limitation without claiming zero Dojang or showing guessed records", () =>
  withLocation("?view=explore&source=backend&history=recent", () => {
    const html = renderToStaticMarkup(
      createElement(HistoricalExplorer, { recent: true }),
    );
    assert.match(html, /Dojang 분류 미제공/);
    assert.match(html, /기록 부재를 뜻하지 않습니다/);
    assert.doesNotMatch(html, /<form|issuance-list|activity-list|공식 도장/);
    assert.match(html, /source=backend&amp;catalog=dojang/);
  }));
