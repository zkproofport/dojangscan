import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "./fixtures/recorded-content.json";
import { RecordedContentPanel } from "../components/recorded-content";
import { RecordOverview } from "../components/record-context";
import {
  recordedContentView,
  type RecordedContent,
} from "../lib/recorded-content";
import { adaptDetail } from "../lib/backend-adapter";
import { recordEvidence } from "../lib/product-experience";
import { createBackendClient, type BackendDetail } from "../lib/backend-api";
const detail = fixture.details[0] as BackendDetail;
const render = (content: unknown, ko = true) =>
  renderToStaticMarkup(
    createElement(RecordedContentPanel, {
      value: content,
      schema: detail.data.schema,
      ko,
    }),
  );
test("six stored payload interpretations display content without changing projection, classification or UNKNOWN", () => {
  assert.equal(fixture.details.length, 6);
  for (const input of fixture.details) {
    const d = input as BackendDetail,
      before = structuredClone(d);
    assert.equal(
      recordedContentView(d.content, d.data.schema).state,
      "available",
    );
    const html = renderToStaticMarkup(
      createElement(RecordedContentPanel, {
        value: d.content,
        schema: d.data.schema,
        ko: true,
      }),
    );
    assert.match(html, /작업 코드/);
    assert.match(html, /UNKNOWN/);
    assert.match(html, /내용 해석 근거·식별값/);
    const front = html.split("<details")[0];
    assert.doesNotMatch(front, /occurrenceId|credentialRefsHash|<code>/);
    assert.equal(recordEvidence(d).decision, "UNKNOWN");
    assert.equal(recordEvidence(d).status, "unknown");
    assert.deepEqual(adaptDetail(d).record.fields, []);
    assert.equal(d.meta.freshness, "stale");
    assert.equal(d.meta.coverage.pending, 987);
    assert.deepEqual(d, before);
  }
});
test("legacy absence and all interpretation failure states remain distinct in Korean and English", () => {
  assert.match(render(undefined), /기록 내용 미제공/);
  assert.match(render(undefined, false), /Record content unavailable/);
  for (const [status, reason, ko, en] of [
    [
      "unavailable",
      "STORED_PAYLOAD_UNAVAILABLE",
      "기록 내용 미제공",
      "Content unavailable",
    ],
    ["invalid", "PAYLOAD_ABI_INVALID", "형식·식별", "format or identity"],
    ["limited", "CONTENT_SIZE_LIMIT", "크기 제한", "display limit"],
  ]) {
    const c = { ...detail.content, status, reasons: [reason], fields: [] };
    assert.ok(render(c).includes(ko));
    assert.ok(render(c, false).includes(en));
    assert.match(render(c), /UNKNOWN/);
    assert.doesNotMatch(render(c), /도장이 없습니다|유효한 도장/);
  }
});
test("malformed or wrong schema responses are content errors, never empty success or fallback", () => {
  for (const value of [
    null,
    {},
    { ...detail.content, schema: "0x" + "f".repeat(64) },
    { ...detail.content, limitations: [] },
    {
      ...detail.content,
      fields: [{ name: "bad", type: "string", value: { secret: "x" } }],
    },
    { ...detail.content, version: "future-version" },
  ]) {
    assert.equal(
      recordedContentView(value, detail.data.schema).state,
      "contract-error",
    );
    assert.match(render(value), /role="alert"/);
    assert.match(render(value), /응답 오류/);
  }
});
test("untrusted strings stay escaped text; numeric codes are not converted into eligibility or dates", () => {
  const c = {
    ...detail.content,
    fields: [
      { name: "note", type: "string", value: "<img src=x onerror=alert(1)>" },
      { name: "occurredDay", type: "uint32", value: "20775" },
    ],
  } as RecordedContent;
  const html = render(c);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /20775/);
  assert.match(html, /단위·날짜 변환 없이/);
  assert.match(render(c, false), /without unit or date conversion/);
});
test("overview shows issuer and recipient with new content and removes the misleading empty-content summary", () => {
  const html = renderToStaticMarkup(
    createElement(RecordOverview, {
      schema: detail.data.schema,
      issuer: detail.data.issuer,
      recipient: detail.data.recipient,
      issuedAt: detail.data.issuedAt,
      fields: [],
      uid: detail.data.uid,
      source: "Stored Live fixture",
      contentSlot: createElement(RecordedContentPanel, {
        value: detail.content,
        schema: detail.data.schema,
        ko: true,
      }),
    }),
  );
  assert.match(html, /발행자/);
  assert.match(html, /수신자/);
  assert.match(html, /발급 시점/);
  assert.match(html, /작업 코드/);
  assert.doesNotMatch(html, /해석된 요약 내용이 없거나/);
});
test("detail client preserves optional content; old APIs still work and HTTP errors are not converted to content absence", async () => {
  for (const withContent of [true, false]) {
    const data = structuredClone(detail);
    if (!withContent) delete data.content;
    let count = 0;
    const client = createBackendClient(
      data.meta.network,
      async () => {
        count++;
        return new Response(JSON.stringify(data));
      },
      "/api/dojangscan",
    );
    const result = await client.detail(data.data.uid);
    assert.deepEqual(result, data);
    assert.equal(count, 1);
  }
  const client = createBackendClient(
    detail.meta.network,
    async () =>
      new Response(JSON.stringify({ error: "UNAVAILABLE" }), { status: 503 }),
    "/api/dojangscan",
  );
  await assert.rejects(() => client.detail(detail.data.uid), {
    status: 503,
    code: "UNAVAILABLE",
  });
});
