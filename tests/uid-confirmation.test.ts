import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  UIDConfirmation,
  OtherRecordPaths,
} from "../components/uid-confirmation";
import { resolveProductLookup } from "../lib/product-experience";
import type { BackendDetail } from "../lib/backend-api";
import type { HistoricalPage } from "../lib/historical-api";
const capture = JSON.parse(
  readFileSync(
    new URL("./fixtures/real-public-records.json", import.meta.url),
    "utf8",
  ),
);
const get = (name: string) =>
  capture.responses.find((x: { label: string }) => x.label === name).body;
const render = (props: Parameters<typeof UIDConfirmation>[0]) =>
  renderToStaticMarkup(createElement(UIDConfirmation, props));
test("Case A: real decoded content answers the question before technical evidence; all source data stays available explicitly", () => {
  const live: BackendDetail = get("content-4");
  for (const ko of [true, false]) {
    const html = render({ live, uid: live.data.uid, source: "live", ko });
    assert.ok(html.indexOf("FREE") < html.indexOf("<details"));
    assert.match(html, /COMMON/);
    assert.match(html, /20261116/);
    assert.equal((html.match(/<details/g) || []).length, 1);
    assert.doesNotMatch(html, /<pre|ALLOW|현재 자격 UNKNOWN/);
    assert.match(html, /aria-expanded="false"/);
    assert.ok(
      html.includes(
        ko
          ? "Dojang 분류 미확인"
          : "Dojang classification unconfirmed",
      ),
    );
    assert.ok(html.includes(ko ? "발급 기록" : "Issuance record"));
  }
});
test("Case B: actual Recent issuance exists without Payload or verified receipt; Indexer is not another issuance", () => {
  const events: HistoricalPage = get("recent-detail");
  const uid = events.data[0].uid!;
  const before = JSON.stringify(events);
  const html = render({ events, uid, source: "recent", ko: true });
  const basic = html.split("<details")[0];
  assert.match(basic, /발급 이벤트 확인/);
  assert.match(basic, /기록 내용 미제공/);
  assert.match(basic, /거래 포함 검증 정보 미제공/);
  assert.doesNotMatch(
    basic,
    /AttestationIndexed|Receipt|UNKNOWN|canonical|projection/,
  );
  assert.equal((basic.match(/<li>/g) || []).length, 1);
  assert.match(html, /AttestationIndexed/);
  assert.match(basic, /발급·철회와 별개/);
  assert.equal(JSON.stringify(events), before);
});
test("Case C: Dojang classification and issuer true remain separate from eligibility and identity verification", () => {
  const live: BackendDetail = get("dojang-detail");
  const html = render({ live, uid: live.data.uid, source: "live", ko: true });
  assert.match(html, /Dojang · 서버 분류/);
  assert.match(html, /예 · 발행자가 기록한 값/);
  assert.match(html, /신원 검증 결과가 아닙니다/);
  assert.match(html, /현재 이용 자격을 보증하지 않습니다/);
  assert.match(html, /거래 포함 검증 정보 미제공/);
});
test("bare UID uses content-rich stored detail while shared Recent links keep their scope; other paths do not merge", () => {
  const live: BackendDetail = get("content-4");
  const target = resolveProductLookup(live.data.uid)!;
  assert.equal(target.source, "backend");
  assert.ok(!target.href.includes("history="));
  const recent = resolveProductLookup(
    `https://dojangscan.com/?view=explore&source=backend&history=recent&uid=${live.data.uid}`,
  )!;
  assert.equal(recent.source, "recent");
  const html = renderToStaticMarkup(
    createElement(OtherRecordPaths, {
      uid: live.data.uid,
      source: "live",
      ko: true,
    }),
  );
  assert.match(html, /history=recent/);
  assert.match(html, /source=public/);
  assert.match(html, /별도 요청/);
  assert.equal((html.match(new RegExp(live.data.uid, "g")) || []).length, 2);
});
test("synthetic adverse state: a foreign UID revocation cannot change the selected record, verified receipt never proves truth", () => {
  const events: HistoricalPage = structuredClone(get("recent-detail"));
  const uid = events.data[0].uid!;
  events.data.push({
    ...events.data[0],
    id: "synthetic-foreign",
    uid: "0x" + "f".repeat(64),
    event: "Revoked",
  });
  events.data.find((e) => e.event === "Attested")!.receiptVerified = true;
  const html = render({ events, uid, source: "recent", ko: true });
  assert.doesNotMatch(html, /철회 이벤트 1건/);
  assert.match(html, /발급 거래 포함 근거 검증됨/);
  assert.match(html, /내용의 진실성이나 현재 이용 자격을 보증하지 않습니다/);
});
test("mismatched UID or mixed-source inputs fail closed instead of constructing a combined result", () => {
  const live: BackendDetail = get("dojang-detail");
  const html = render({
    live,
    uid: "0x" + "f".repeat(64),
    source: "live",
    ko: true,
  });
  assert.match(html, /일치하지 않아/);
  assert.doesNotMatch(html, /발급 이벤트 확인/);
  const mixed = render({
    live,
    events: get("recent-detail"),
    uid: live.data.uid,
    source: "live",
    ko: false,
  });
  assert.match(mixed, /no result is shown/);
});

test("neutral hero and collapsed numeric codes preserve real values without making them claims", () => {
 const live: BackendDetail = get("content-4");
 const html = render({live, uid:live.data.uid,source:"live",ko:false});
 const title=html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1];
 assert.equal(title,"Issuance record");
 const basic=html.split("<details")[0];
 assert.match(basic,/FREE/); assert.match(basic,/COMMON/);
 assert.doesNotMatch(basic,/20261116|drawNonce|seedHash|dataHash/);
 assert.match(html.split("<details")[1],/20261116/);
 assert.match(basic,/as recorded/);
});
