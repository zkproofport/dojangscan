import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActivityList,
  ActivityEvidence,
  activityTitle,
} from "../components/activity-list";
import { RecordedContentPanel } from "../components/recorded-content";
import type { HistoricalEvent } from "../lib/historical-api";
import fixture from "./fixtures/recorded-content-additional.json";

const hash = "0x" + "a".repeat(64);
const address = "0x" + "b".repeat(40);
const event: HistoricalEvent = {
  id: "event-a",
  uid: hash,
  event: "Attested",
  kind: "eas",
  contract: address,
  blockNumber: 42237000,
  blockHash: hash,
  transactionHash: hash,
  logIndex: 9,
  schema: "0x" + "c".repeat(64),
  issuer: address,
  recipient: "0x" + "0".repeat(40),
  indexKey: null,
  receiptVerified: false,
  verification: "discovery-only",
  eventFields: { note: "<script>never execute</script>" },
};
const markup = (events: HistoricalEvent[], ko = true) =>
  renderToStaticMarkup(
    createElement(ActivityList, {
      events,
      ko,
      source: "recent",
      onSelect: () => {},
    }),
  );

test("unknown-schema titles state the observed event rather than inventing an attestation type", () => {
  assert.equal(activityTitle(event, true), "EAS 발급");
  assert.equal(activityTitle({ ...event, event: "Revoked" }, true), "EAS 철회");
  assert.equal(
    activityTitle({ ...event, event: "AttestationIndexed" }, false),
    "Indexer changed",
  );
  assert.match(markup([event]), /종류 미확인/);
  assert.doesNotMatch(markup([event]), /스키마 이름 미확인|<details|<pre/);
});

test("each event stays separate in response order, including multiple events for the same UID", () => {
  const events = [
    { ...event, id: "later", event: "Revoked", blockNumber: 42237001 },
    event,
  ];
  const before = structuredClone(events);
  const html = markup(events);
  assert.equal((html.match(/class="activity-row"/g) ?? []).length, 2);
  assert.ok(html.indexOf("EAS 철회") < html.indexOf("EAS 발급"));
  assert.deepEqual(events, before);
  assert.match(html, /issuer=0xbb/);
  assert.match(html, /recipient=0x00/);
  assert.match(html, /history=recent/);
  assert.match(html, /개별 수신자 없음/);
});

test("row actions retain the exact selected event, including records without a UID", () => {
  const absent = { ...event, id: "without-uid", uid: null };
  let selected: HistoricalEvent | undefined,
    evidence: HistoricalEvent | undefined;
  const list = ActivityList({
    events: [absent],
    ko: true,
    source: "recent",
    onSelect: (e) => {
      selected = e;
    },
    onEvidence: (e) => {
      evidence = e;
    },
  });
  const row = list.props.children[0];
  row.props.children[1].props.children[0].props.onClick();
  row.props.children[4].props.onClick();
  assert.equal(selected, absent);
  assert.equal(evidence, absent);
  assert.match(markup([absent]), /UID 없는 계약 기록/);
});

test("receipt verification and discovery-only stay distinct; raw evidence and hashes remain accessible and escaped", () => {
  const events = [
    event,
    {
      ...event,
      id: "verified",
      receiptVerified: true,
      verification: "receipt-verified" as const,
    },
  ];
  for (const ko of [true, false]) {
    const html = markup(events, ko);
    assert.match(html, /Receipt/);
    assert.match(html, ko ? /Receipt 미검증/ : /receipt unverified/);
    const proof = renderToStaticMarkup(
      createElement(ActivityEvidence, { events, ko }),
    );
    assert.ok(proof.includes(hash));
    assert.match(
      proof,
      ko ? /거래 증거 미검증/ : /transaction evidence unchecked/,
    );
    assert.match(
      proof,
      ko ? /거래 증거 대조 완료/ : /Transaction evidence checked/,
    );
    assert.match(proof, ko ? /원본 JSON 보기/ : /View source JSON/);
    assert.doesNotMatch(proof, /<pre|never execute/);
    assert.doesNotMatch(proof, /<script>|<details/);
  }
});

test("summary keeps recorded values and copy actions; a single evidence area retains identifiers without nested disclosures", () => {
  for (const sample of fixture.samples)
    for (const ko of [true, false]) {
      const props = {
        value: sample.content,
        schema: sample.content.schema,
        ko,
        showDecision: false,
      };
      const summary = renderToStaticMarkup(
        createElement(RecordedContentPanel, {
          ...props,
          presentation: "summary",
        }),
      );
      const proof = renderToStaticMarkup(
        createElement(RecordedContentPanel, {
          ...props,
          presentation: "evidence",
        }),
      );
      for (const f of sample.content.fields) {
        if (f.type === "bytes32") {
          assert.ok(!summary.includes(f.value));
          assert.ok(proof.includes(f.value));
        } else assert.ok(summary.includes(f.value));
        assert.ok(
          (f.type === "bytes32" ? proof : summary).includes(
            ko ? `${f.name} 값 복사` : `Copy ${f.name}`,
          ),
        );
      }
      assert.ok(proof.includes(sample.content.definitionEvidence.sourceSHA256));
      assert.doesNotMatch(
        summary + proof,
        /<details|<time|ALLOW|현재 이용 가능/,
      );
      assert.match(summary, ko ? /발행자의 기록/ : /issuer assertion/);
    }
});

test("missing, invalid, size-limited and malformed content stay distinct in the compact detail", () => {
  const c = fixture.samples[0].content;
  const render = (value: unknown) =>
    renderToStaticMarkup(
      createElement(RecordedContentPanel, {
        value,
        schema: c.schema,
        ko: true,
        presentation: "summary",
      }),
    );
  assert.match(render(undefined), /기록 내용 미제공/);
  assert.match(render(null), /role="alert"/);
  assert.match(
    render({
      ...c,
      status: "invalid",
      reasons: ["PAYLOAD_ABI_INVALID"],
      fields: [],
    }),
    /형식·식별 정보 불일치/,
  );
  assert.match(
    render({
      ...c,
      status: "limited",
      reasons: ["CONTENT_SIZE_LIMIT"],
      fields: [],
    }),
    /크기 제한/,
  );
  assert.match(
    render({
      ...c,
      status: "unavailable",
      reasons: ["STORED_PAYLOAD_UNAVAILABLE"],
      fields: [],
    }),
    /기록 부재나 무효를 뜻하지 않습니다/,
  );
});
