import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SCHEMAS } from "../lib/giwa";
import type { BackendDetail } from "../lib/backend-api";
import type { HistoricalEvent } from "../lib/historical-api";
import {
  resolveProductLookup,
  initialProductView,
  recordEvidence,
  chronologicalEvents,
  addressRoleURL,
  recordFieldValue,
} from "../lib/product-experience";
import {
  RecordEvidence,
  RecordObservation,
  EventTimeline,
  RecordOverview,
  RecordContentPreview,
} from "../components/record-context";
import ProductHome from "../components/product-home";
import {
  AddressRecordSearch,
  StoredRecordContext,
  EmptyStoredRecords,
} from "../components/stored-record-context";
import { ErrorNotice } from "../components/backend-explorer";
import { BackendError } from "../lib/backend-api";

const uid = "0x" + "1".repeat(64),
  address = "0x" + "2".repeat(40);
const query = (s: string) => new URLSearchParams(s.split("?")[1]);
const detail: BackendDetail = {
  meta: {
    network: "test",
    chainId: "91342",
    asOfBlock: 11,
    evaluatedBlock: 10,
    blockHash: null,
    observedAt: null,
    verifiedAt: "",
    freshness: "unknown",
    projectionGeneration: "g",
    stateEvaluationReady: false,
    range: { from: 1, through: 11, requestedRangeComplete: false },
    coverage: {
      raw_complete: false,
      hydration_complete: false,
      certifiedBlocks: 10,
      pending: 1,
      exhausted: 0,
    },
  },
  data: {
    uid,
    schema: SCHEMAS[0].uid,
    issuer: address,
    recipient: address,
    issuedAt: "1",
    issued: true,
    notRevoked: true,
    notExpired: true,
    currentIndexSelected: false,
    policyAccepted: true,
    dependencyValid: null,
    issuerRegistered: null,
    issuerRegisteredAtIssuance: null,
    schemaRegistered: null,
    fields: {},
    reasons: ["INITIAL_STATE_UNKNOWN"],
  },
};

test("home is a new no-query entry; legacy deep links retain their exploration route", () => {
  assert.equal(initialProductView(""), "home");
  for (const s of [
    "?uid=" + uid,
    "?source=backend",
    "?schema=" + uid,
    "?issuer=" + address,
    "?tx=" + uid,
  ])
    assert.equal(initialProductView(s), "explore");
  for (const v of [
    "explore",
    "wallet",
    "issuer",
    "issuers",
    "codes",
    "lab",
    "schemas",
    "workspace",
  ])
    assert.equal(initialProductView("?view=" + v), v);
});
test("UID, schema, and wallet/issuer purposes route to explicit stored record APIs", () => {
  assert.equal(resolveProductLookup(uid)?.source, "backend");
  const wallet = resolveProductLookup(address)!;
  assert.equal(wallet.source, "backend");
  assert.equal(query(wallet.href).get("view"), "recipient-records");
  assert.equal(query(wallet.href).get("recipient"), address);
  const issuer = resolveProductLookup(address, "issuer")!;
  assert.equal(issuer.source, "backend");
  assert.equal(query(issuer.href).get("view"), "issuer-records");
  assert.equal(query(issuer.href).get("issuer"), address);
  assert.equal(resolveProductLookup(address, "schema"), null);
  for (const name of [SCHEMAS[0].name, SCHEMAS[0].label])
    assert.equal(
      query(resolveProductLookup(name)!.href).get("schema"),
      SCHEMAS[0].uid,
    );
  assert.equal(
    query(resolveProductLookup(uid, "schema")!.href).get("schema"),
    uid,
  );
});
test("pasted shares retain explicit Public, Live, Historical semantics; arbitrary redirects are rejected", () => {
  assert.equal(
    resolveProductLookup(`https://dojangscan.com/?uid=${uid}`)?.source,
    "public",
  );
  assert.equal(
    resolveProductLookup(`https://dojangscan.com/?source=backend&uid=${uid}`)
      ?.source,
    "backend",
  );
  const history = resolveProductLookup(
    `https://dojangscan.com/?history=backfill&source=backend&uid=${uid}`,
  )!;
  assert.equal(history.source, "history");
  assert.equal(query(history.href).get("history"), "backfill");
  for (const v of [
    `https://evil.test/?uid=${uid}`,
    `https://dojangscan.com.evil.test/?uid=${uid}`,
    `https://user:secret@dojangscan.com/?uid=${uid}`,
    "javascript:alert(1)",
    "invalid",
    "0x123",
    "",
  ])
    assert.equal(resolveProductLookup(v), null);
});
test("UNKNOWN, Indexer non-selection, and Receipt evidence remain separate from eligibility", () => {
  const evidence = recordEvidence(detail);
  assert.equal(evidence.status, "active");
  assert.equal(evidence.index, "not-selected");
  assert.equal(evidence.decision, "UNKNOWN");
  assert.equal(evidence.receipt, "not-exposed");
  assert.equal(evidence.partial, true);
  assert.equal(
    recordEvidence({ ...detail, data: { ...detail.data, notRevoked: null } })
      .status,
    "unknown",
  );
  assert.equal(
    recordEvidence({ ...detail, data: { ...detail.data, notRevoked: false } })
      .status,
    "revoked",
  );
  assert.equal(
    recordEvidence({
      ...detail,
      data: { ...detail.data, issuanceEventObserved: false },
    }).event,
    "unknown",
  );
  const markup = renderToStaticMarkup(
    createElement(RecordEvidence, { detail }),
  );
  assert.match(markup, /UNKNOWN/);
  assert.match(markup, /ALLOW/);
  assert.match(markup, /API 미제공/);
  assert.match(markup, /INITIAL_STATE_UNKNOWN/);
  const state = renderToStaticMarkup(
    createElement(RecordObservation, { detail }),
  );
  assert.match(markup, /미선택은 철회가 아닙니다/);
  assert.doesNotMatch(state, /Indexer/);
  assert.match(state, /시각 미확인/);
});
test("Historical timeline sorts only linked events on the page without inferring times or current state", () => {
  const e = {
    id: "late",
    uid,
    event: "Revoked",
    blockNumber: 12,
    logIndex: 2,
    receiptVerified: false,
  } as HistoricalEvent;
  const events = [
    e,
    {
      ...e,
      id: "early",
      event: "Attested",
      blockNumber: 11,
      receiptVerified: true,
    },
    { ...e, id: "foreign", uid: "0x" + "9".repeat(64) },
  ];
  assert.deepEqual(
    chronologicalEvents(events, uid).map((x) => x.id),
    ["early", "late"],
  );
  assert.equal(events[0].id, "late");
  const markup = renderToStaticMarkup(
    createElement(EventTimeline, {
      uid,
      page: {
        meta: { network: "test", snapshot: "s", observedAt: "" },
        data: events,
        next: "cursor",
      },
    }),
  );
  assert.ok(markup.indexOf("발급 기록") < markup.indexOf("철회 기록"));
  assert.match(markup, /이벤트 시각을 제공하지 않습니다/);
  assert.match(markup, /Receipt 검증 확인 안 됨/);
  assert.doesNotMatch(markup, /foreign/);
});
test("main offers purposes without invented usage totals; summary does not treat zero recipient as a wallet", () => {
  const home = renderToStaticMarkup(createElement(ProductHome));
  for (const label of [
    "도장 기록 조회",
    "발급 내역과 기록 내용",
    "받은 도장 조회",
    "발급한 기록 조회",
  ])
    assert.ok(home.includes(label));
  assert.doesNotMatch(home, /1,377|100,000|product-tasks/);
  assert.equal((home.match(/<input /g) ?? []).length, 1);
  assert.doesNotMatch(home, /<select|조회 범위<|정적 추천/);
  const summary = renderToStaticMarkup(
    createElement(RecordOverview, {
      uid,
      schema: "unknown",
      issuer: address,
      recipient: "0x" + "0".repeat(40),
      issuedAt: null,
      fields: [],
      source: "Live",
    }),
  );
  assert.match(summary, /개별 수신 지갑 없음/);
  assert.match(summary, /발급 기록/);
  assert.doesNotMatch(summary, /공식 도장/);
  assert.match(summary, /시각 미확인/);
});

test("stored results disclose stale observations, projection-only scope and UNKNOWN", () => {
  const html = renderToStaticMarkup(
    createElement(StoredRecordContext, {
      meta: {
        ...detail.meta,
        freshness: "stale",
        observedAt: "2026-11-20T22:33:01.315Z",
        evaluatedBlock: 41472564,
      },
    }),
  );
  for (const text of [
    "Live 저장 기록 · 최신성 주의",
    "projection",
    "미평가 UID",
    "전체 체인의 기록 부재",
    "41,472,564",
    "UNKNOWN",
    "부분 수집",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /실시간 상태|자격 승인|Worker 정상/);
});

test("address lookup is unsigned; issuer management is a separate explicit action", () => {
  const props = {
    value: address,
    busy: false,
    onChange: () => {},
    onSubmit: () => {},
  };
  const recipient = renderToStaticMarkup(
    createElement(AddressRecordSearch, { ...props, recipient: true }),
  );
  assert.match(recipient, /지갑 연결·서명은 필요하지 않습니다/);
  assert.match(recipient, /수신 내역/);
  assert.match(recipient, /발급 내역/);
  assert.doesNotMatch(recipient, /mode=manage/);
  const issuer = renderToStaticMarkup(
    createElement(AddressRecordSearch, { ...props, recipient: false }),
  );
  assert.match(issuer, /mode=manage/);
  assert.match(issuer, /서명 필요/);
  for (const status of [400, 429, 502, 503, 504]) {
    const error = renderToStaticMarkup(
      createElement(ErrorNotice, {
        error: new BackendError(status, "UNAVAILABLE"),
      }),
    );
    assert.match(error, /role="alert"/);
    assert.ok(error.includes(String(status)));
    assert.doesNotMatch(error, /정상 0건|도장이 없습니다/);
  }
});

test("role switches keep the same address with one explicit API role and no cursor", () => {
  for (const recipient of [true, false]) {
    const q = query(addressRoleURL(" 0x" + "A".repeat(40) + " ", recipient));
    assert.equal(
      q.get(recipient ? "recipient" : "issuer"),
      "0x" + "a".repeat(40),
    );
    assert.equal(q.has(recipient ? "issuer" : "recipient"), false);
    assert.equal(q.has("cursor"), false);
    assert.equal(q.get("source"), "backend");
  }
  assert.equal(query(addressRoleURL("bad", true)).has("recipient"), false);
  assert.equal(
    initialProductView("?view=issuer-records&issuer=" + address),
    "issuer-records",
  );
});

test("empty results provide explicit next actions without data controls or chain absence claims", () => {
  const html = renderToStaticMarkup(
    createElement(EmptyStoredRecords, {
      meta: detail.meta,
      recipient: true,
      address,
      filtered: false,
      onClear: () => {},
      onEdit: () => {},
      onPublic: () => {},
    }),
  );
  assert.match(html, /전체 체인에 도장이 없다는 뜻은 아닙니다/);
  assert.match(html, /마지막 관측/);
  assert.match(html, /다른 주소·조건 조회/);
  assert.match(html, /issuer-records/);
  assert.match(html, /공개 체인에서 조회/);
  assert.doesNotMatch(html, /다음 페이지|JSON 저장|<input|추가 필터 해제/);
  const front = html.split("<details>")[0];
  assert.match(front, /현재 이용 자격을 확인할 수 없습니다/);
  assert.doesNotMatch(front, /projection|Generation|연속 평가 완료 블록/);
});

test("content previews translate issuer assertions without inventing verification or units", () => {
  const html = renderToStaticMarkup(
    createElement(RecordContentPreview, {
      fields: [
        { name: "isVerified", value: "true" },
        { name: "salt", value: "SECRETLIKE_HASH" },
        { name: "balance", value: "1000000000000000000" },
        { name: "proofs", value: "PROOF_BYTES" },
      ],
    }),
  );
  assert.match(html, /발행자가 기록한 주소 인증 여부/);
  assert.match(html, /예 · 발행자가 기록한 값/);
  assert.match(html, /1000000000000000000/);
  assert.doesNotMatch(html, /SECRETLIKE_HASH|PROOF_BYTES|ETH|인증 완료/);
  assert.equal(
    recordFieldValue("isVerified", "false", false),
    "No · recorded by issuer",
  );
  assert.equal(recordFieldValue("unknown", "true", false), "true");
  assert.match(
    renderToStaticMarkup(createElement(RecordContentPreview, { fields: [] })),
    /해석된 발급 내용 없음/,
  );
});
