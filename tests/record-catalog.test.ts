import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  projectionCategory,
  issuanceReferences,
  catalogView,
  catalogURL,
} from "../lib/record-catalog";
import {
  IssuanceList,
  RecordHistory,
  CatalogNavigation,
} from "../components/record-catalog";
import { SourceJSON } from "../components/source-json";
import { downloadJSON } from "../lib/download-json";
import type { HistoricalPage, HistoricalEvent } from "../lib/historical-api";
const uid = "0x" + "a".repeat(64),
  address = "0x" + "b".repeat(40);
const event: HistoricalEvent = {
  id: "issuance",
  uid,
  event: "Attested",
  kind: "eas",
  contract: address,
  blockNumber: 42,
  blockHash: uid,
  transactionHash: uid,
  logIndex: 1,
  schema: uid,
  issuer: address,
  recipient: address,
  indexKey: null,
  receiptVerified: false,
};
const page: HistoricalPage = {
  meta: { network: "n1", snapshot: "s1", observedAt: "2026-11-25T00:00:00Z" },
  data: [
    event,
    { ...event, id: "index", event: "AttestationIndexed", logIndex: 2 },
    { ...event, id: "revoke", event: "Revoked", logIndex: 3 },
  ],
  next: "next",
};

test("only exact server classifications assign Dojang or external EAS; absent and unfamiliar values stay unconfirmed", () => {
  assert.equal(projectionCategory({ classification: "dojang" }), "dojang");
  assert.equal(projectionCategory({ classification: "external_eas" }), "eas");
  for (const classification of [
    undefined,
    "UNKNOWN",
    "unclassified",
    "official",
    "active",
    "verified",
    "DOJANG",
    "",
  ])
    assert.equal(projectionCategory({ classification }), "unconfirmed");
});
test("Recent issuance references exclude Indexer/revocation from record rows without changing their history", () => {
  const before = structuredClone(page),
    records = issuanceReferences(page);
  assert.equal(records.length, 1);
  assert.equal(records[0].category, "unconfirmed");
  assert.equal(records[0].event, event);
  assert.deepEqual(page, before);
  const html = renderToStaticMarkup(
    createElement(RecordHistory, {
      events: page.data,
      ko: true,
      onSelect: () => {},
    }),
  );
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
  assert.ok(html.indexOf("발급 기록") < html.indexOf("조회 연결"));
  assert.ok(html.indexOf("조회 연결") < html.indexOf("철회 기록"));
});
test("issuances are not falsely merged across snapshots/networks or repeated UID event locators", () => {
  const same = {
    ...event,
    id: "second-origin",
    blockHash: "0x" + "c".repeat(64),
  };
  const refs = issuanceReferences({ ...page, data: [event, same] });
  assert.equal(refs.length, 2);
  assert.notEqual(refs[0].event.blockHash, refs[1].event.blockHash);
  const other = issuanceReferences({
    ...page,
    meta: { ...page.meta, network: "n2" },
  });
  assert.notEqual(other[0].network, refs[0].network);
});
test("receipt evidence does not upgrade Recent classification or establish a current decision", () => {
  const refs = issuanceReferences({
    ...page,
    data: [{ ...event, receiptVerified: true }],
  });
  assert.equal(refs[0].category, "unconfirmed");
  for (const ko of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(IssuanceList, {
        records: refs,
        ko,
        source: "recent",
        onOpen: () => {},
      }),
    );
    assert.doesNotMatch(html, /공식|official|ALLOW|Receipt|<pre|<details|#42/);
    assert.match(html, /recipient=/);
    assert.match(html, /issuer=/);
    assert.match(html, /history=recent/);
    assert.ok(html.includes(ko ? "발급 기록" : "Issuance record"));
  }
});
test("legacy UID/address and event URLs remain accessible; category changes preserve address and discard page cursor", () => {
  assert.equal(catalogView("?history=recent", true), "dojang");
  assert.equal(catalogView("?uid=" + uid, true), "unconfirmed");
  assert.equal(catalogView("?recipient=" + address, true), "unconfirmed");
  assert.equal(catalogView("?event=Revoked", true), "events");
  const q = new URLSearchParams(
    catalogURL(
      "eas",
      "?view=explore&source=backend&recipient=" +
        address +
        "&cursor=old&uid=" +
        uid,
    ),
  );
  assert.equal(q.get("recipient"), address);
  assert.equal(q.get("catalog"), "eas");
  assert.equal(q.has("cursor"), false);
  assert.equal(q.has("uid"), false);
});
test("category navigation never calls unconfirmed EAS non-Dojang", () => {
  for (const ko of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(CatalogNavigation, {
        current: "unconfirmed",
        ko,
        eventSource: true,
      }),
    );
    assert.match(html, /catalog=dojang/);
    assert.match(html, /catalog=unconfirmed/);
    assert.match(html, /catalog=events/);
    assert.doesNotMatch(html, /catalog=eas|공식|official/);
  }
});
test("raw JSON is an explicit action rather than default content", () => {
  const html = renderToStaticMarkup(
    createElement(SourceJSON, { value: page, name: "evidence.json", ko: true }),
  );
  assert.doesNotMatch(html, /<pre|blockHash|logIndex/);
  assert.match(html, /원본 JSON 보기/);
  assert.match(html, /JSON 다운로드/);
  assert.match(html, /aria-expanded="false"/);
});
test("JSON download retains exact events, identity, order and receipt fields", async () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL;
  let captured: Blob | undefined,
    clicked = false;
  const link = {
    href: "",
    download: "",
    click() {
      clicked = true;
    },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => link },
  });
  URL.createObjectURL = (b) => {
    captured = b as Blob;
    return "blob:fixture";
  };
  URL.revokeObjectURL = () => {};
  try {
    downloadJSON(page, "evidence.json");
    assert.ok(clicked);
    assert.equal(link.download, "evidence.json");
    assert.deepEqual(JSON.parse(await captured!.text()), page);
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
  }
});
