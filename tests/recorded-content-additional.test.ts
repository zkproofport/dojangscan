import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "./fixtures/recorded-content-additional.json";
import { RecordedContentPanel } from "../components/recorded-content";
import { recordedContentView, contentFieldLabel } from "../lib/recorded-content";

test("eight saved Payload interpretations use the existing optional content contract in both languages", () => {
  assert.equal(fixture.samples.length, 8);
  assert.equal(new Set(fixture.samples.map((s) => s.content.schema)).size, 3);
  for (const sample of fixture.samples) {
    const before = structuredClone(sample);
    assert.equal(recordedContentView(sample.content, sample.content.schema).state, "available");
    for (const ko of [true, false]) {
      const html = renderToStaticMarkup(createElement(RecordedContentPanel, {
        value: sample.content, schema: sample.content.schema, ko,
      }));
      const summary = html.split("<details")[0];
      for (const field of sample.content.fields) {
        assert.ok(html.includes(contentFieldLabel(field.name, ko)));
        if (field.type === "bytes32") {
          assert.ok(!summary.includes(field.value));
          assert.ok(html.includes(field.value));
          assert.ok(html.includes(ko ? `${field.name} 값 복사` : `Copy ${field.name}`));
        } else {
          assert.ok(summary.includes(field.value));
        }
      }
      assert.match(summary, /UNKNOWN/);
      assert.ok(summary.includes(ko ? "의미·단위·날짜를 임의로 추정하지" : "meanings, units and dates are not inferred"));
      assert.doesNotMatch(summary, /ALLOW|유효한 도장|verified eligibility/);
    }
    assert.deepEqual(sample, before);
  }
});

test("new string and number fields retain raw recorded values rather than invented descriptions or dates", () => {
  const sample = fixture.samples.find((s) => s.content.fields.some((f) => f.name === "drawKind"))!;
  const values = Object.fromEntries(sample.content.fields.map((f) => [f.name, f.value]));
  const html = renderToStaticMarkup(createElement(RecordedContentPanel, {
    value: sample.content, schema: sample.content.schema, ko: true,
  })).split("<details")[0];
  for (const key of ["drawKind", "rarity", "modelId", "drawNonce", "day"]) assert.ok(html.includes(values[key]));
  assert.match(html, /기록된 drawKind 값|기록된 rarity 값/);
  assert.match(html, /기록된 day 값/);
  assert.doesNotMatch(html, /<time|신발 소유자|러너 지갑|현재 이용 가능/);
  assert.equal(recordedContentView(undefined, sample.content.schema).state, "not-provided");
});
