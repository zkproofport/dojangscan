import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UIDConfirmation } from "../components/uid-confirmation";
import { readRecordInformation } from "../lib/record-information";
import { resolveProductLookup } from "../lib/product-experience";
const capture = JSON.parse(
  fs.readFileSync("tests/fixtures/uid-experience.json", "utf8"),
);
const get = (label: string) =>
  capture.responses.find((r: any) => r.label === label).body;
const render = (live: any, ko: boolean) =>
  renderToStaticMarkup(
    createElement(UIDConfirmation, {
      live,
      uid: live.data.uid,
      source: "live",
      ko,
    }),
  );
test("real enriched UID follows search routing and renders issuance, content, changes and evidence in both languages", () => {
  const live = get("verified-issuance");
  assert.ok(resolveProductLookup(live.data.uid)?.href.includes(live.data.uid));
  for (const ko of [true, false]) {
    const html = render(live, ko),
      main = html.split("<details")[0];
    assert.match(
      main,
      ko ? /Dojang 발급 근거 확인/ : /Dojang issuance evidence confirmed/,
    );
    assert.match(main, ko ? /철회 사실 확인/ : /Revocation observed/);
    assert.match(main, ko ? /발행자가 기록한 값/ : /recorded by issuer/);
    assert.match(
      main,
      ko ? /현재 이용 자격을 보증하지 않습니다/ : /current eligibility/,
    );
    assert.doesNotMatch(
      main,
      /historical-issuance|SUPPORTED_WITH|UNKNOWN|<pre/,
    );
    assert.ok(html.includes(live.recordInformation.issuance.transactionHash));
  }
});
test("real relation-only and general EAS responses remain conservatively labelled on old APIs", () => {
  assert.match(
    render(get("dojang-detail"), true),
    /Dojang 관련성 확인 · 발급 근거 부족/,
  );
  assert.match(
    render(get("external_eas-detail"), false),
    /General EAS record · stored classification/,
  );
});
test("real content is readable without promoting UNKNOWN, and real Recent missing Payload stays explicit", () => {
  const html = render(get("content"), true);
  assert.match(html, /FREE/);
  assert.match(html, /COMMON/);
  assert.match(html, /20261116/);
  assert.match(html, /Dojang 분류 미확인/);
  const events = get("recent-detail");
  const out = renderToStaticMarkup(
    createElement(UIDConfirmation, {
      events,
      uid: events.data[0].uid,
      source: "recent",
      ko: true,
    }),
  );
  assert.match(out, /기록 내용 미제공/);
  assert.doesNotMatch(out, /Dojang 발급 근거 확인/);
});
test("misbound information is an explicit error rather than a downgraded empty record", () => {
  const live = structuredClone(get("verified-issuance"));
  live.recordInformation.issuance.recipient = "0x" + "1".repeat(40);
  assert.equal(readRecordInformation(live), null);
  assert.match(render(live, true), /출처가 일치하지/);
  assert.doesNotMatch(render(live, true), /철회 사실 확인/);
});
test("synthetic malformed and unsupported content remain different from missing content", () => {
  for (const status of ["invalid", "unsupported"] as const) {
    const live = structuredClone(get("verified-issuance"));
    delete live.content;
    live.recordInformation.content.status = status;
    live.recordInformation.content.fields = [];
    const html = render(live, true);
    assert.match(html, status === "invalid" ? /형식을 검증할 수 없습니다/ : /아직 해석을 지원하지 않습니다/);
    assert.doesNotMatch(html, /기록 내용 미제공/);
  }
});
