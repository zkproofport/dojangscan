import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recordedHeadline, recordKind } from "../lib/record-presentation";
import { projectionCategory, issuanceReferences } from "../lib/record-catalog";
import { eventRecordFacts } from "../lib/record-navigation";
import { RecordHistory, IssuanceList } from "../components/record-catalog";
import { RecordedContentPanel } from "../components/recorded-content";
import { SourceJSON } from "../components/source-json";
import type { HistoricalPage } from "../lib/historical-api";
import type { BackendDetail } from "../lib/backend-api";
const data = JSON.parse(
  readFileSync(
    new URL("./fixtures/real-public-records.json", import.meta.url),
    "utf8",
  ),
);
const get = (label: string) =>
  data.responses.find((r: { label: string }) => r.label === label).body;

test("real server Dojang classification is distinct from recorded true and current approval", () => {
  const d: BackendDetail = get("dojang-detail");
  assert.equal(projectionCategory(d.data), "dojang");
  assert.equal(d.data.fields.isVerified, "true");
  assert.equal(d.data.policyAccepted, null);
  assert.match(recordKind(d.data.schema, d.data.uid, true), /형식$/);
});
test("actual Recent same-schema UID stays unconfirmed; issuance and association are one record entry with two history entries", () => {
  const p: HistoricalPage = get("recent-detail");
  assert.equal(p.data.length, 2);
  assert.equal(new Set(p.data.map((x) => x.uid)).size, 1);
  assert.equal(issuanceReferences(p).length, 1);
  assert.equal(issuanceReferences(p)[0].category, "unconfirmed");
  assert.equal(p.content, undefined);
  const facts = eventRecordFacts(p, p.data[0].uid!);
  assert.equal(facts.issuedAt, null); // block number is not an issuance timestamp
  const before = JSON.stringify(p);
  for (const ko of [true, false]) {
    const list = renderToStaticMarkup(
      createElement(IssuanceList, {
        records: issuanceReferences(p),
        ko,
        source: "recent",
        onOpen: () => {},
      }),
    );
    assert.equal((list.match(/<li(?: |>)/g) || []).length, 1);
    assert.doesNotMatch(list, /발급 내역 발견|Issuance found|<pre|<details/);
    const history = renderToStaticMarkup(
      createElement(RecordHistory, { events: p.data, ko, onSelect: () => {} }),
    );
    assert.equal((history.match(/<li>/g) || []).length, 2);
  }
  assert.equal(JSON.stringify(p), before);
});
test("actual decoded string values lead detail; numeric codes/days remain unchanged and hashes stay out of summary", () => {
  const d: BackendDetail = get("content-4");
  assert.equal(
    recordedHeadline(d.content, d.data.schema, d.data.uid, true),
    "발급 기록",
  );
  for (const ko of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(RecordedContentPanel, {
        value: d.content,
        schema: d.data.schema,
        ko,
        presentation: "summary",
        showDecision: false,
      }),
    );
    for (const v of ["FREE", "COMMON", "20261116", "12"])
      assert.ok(html.includes(v));
    assert.doesNotMatch(
      html,
      /2026-11-16|<pre|<details|seedHash|dataHash|bytes32/,
    );
  }
  assert.equal(projectionCategory(d.data), "unconfirmed");
  const invalid = { ...d.content, purpose: "current_eligibility" };
  assert.notEqual(
    recordedHeadline(invalid, d.data.schema, d.data.uid, true),
    "drawKind: FREE · rarity: COMMON",
  );
});
test("actual missing Payload and external EAS do not become invalid or official", () => {
  assert.equal(projectionCategory(get("external_eas-detail").data), "eas");
  const p: HistoricalPage = get("recent-detail");
  const html = renderToStaticMarkup(
    createElement(RecordedContentPanel, {
      value: p.content,
      schema: p.data[0].schema!,
      ko: true,
      presentation: "summary",
      showDecision: false,
    }),
  );
  assert.match(html, /미제공/);
  assert.doesNotMatch(html, /무효|성공|유효한/);
});
test("real JSON is not inline until explicitly requested", () => {
  const html = renderToStaticMarkup(
    createElement(SourceJSON, {
      value: get("recent-detail"),
      name: "real.json",
      ko: true,
    }),
  );
  assert.doesNotMatch(html, /<pre|blockHash|transactionHash/);
  assert.match(html, /aria-expanded="false"/);
});
