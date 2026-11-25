import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeContent, HOME_RECORD_UID } from "../components/product-home";
import {
  addressRoleURL,
  resolveProductLookup,
} from "../lib/product-experience";

const capture = JSON.parse(
  readFileSync(
    new URL("./fixtures/real-public-records.json", import.meta.url),
    "utf8",
  ),
);
const sample = capture.responses.find(
  (r: { label: string }) => r.label === "dojang-detail",
).body;

test("homepage sample is the saved Dojang classification, without a current eligibility claim", () => {
  assert.equal(sample.data.uid, HOME_RECORD_UID);
  assert.equal(sample.data.classification, "dojang");
  assert.equal(sample.data.policyAccepted, null);
  for (const ko of [true, false]) {
    const html = renderToStaticMarkup(createElement(HomeContent, { ko }));
    assert.ok(
      html.includes(
        `?view=explore&amp;source=backend&amp;uid=${HOME_RECORD_UID}`,
      ),
    );
    assert.ok(
      html.includes(
        ko ? "현재 이용 자격 미확인" : "current eligibility unconfirmed",
      ),
    );
    assert.ok(html.includes(ko ? "도장 기록 조회" : "Dojang record lookup"));
    assert.doesNotMatch(
      html,
      /EAS|RPC|Indexer|Projection|공식 도장|verified identity/,
    );
    assert.equal((html.match(/<input /g) || []).length, 1);
    assert.match(html, /type="submit" disabled=""/);
    assert.match(html, /enterKeyHint="search"/);
    assert.match(html, /\?view=recipient-records&amp;source=backend/);
    assert.match(html, /\?view=issuer-records&amp;source=backend/);
  }
});

test("home lookup and secondary actions preserve role and explicit shared source", () => {
  const address = sample.data.recipient;
  for (const recipient of [true, false]) {
    const p = new URLSearchParams(addressRoleURL(address, recipient).slice(1));
    assert.equal(
      p.get("view"),
      recipient ? "recipient-records" : "issuer-records",
    );
    assert.equal(
      p.get(recipient ? "recipient" : "issuer"),
      address.toLowerCase(),
    );
    assert.equal(p.has(recipient ? "issuer" : "recipient"), false);
    assert.equal(p.has("cursor"), false);
  }
  assert.equal(resolveProductLookup("not-a-uid"), null);
  assert.equal(resolveProductLookup(HOME_RECORD_UID)?.source, "backend");
  const recent = resolveProductLookup(
    `https://dojangscan.com/?view=explore&source=backend&history=recent&uid=${HOME_RECORD_UID}`,
  );
  assert.equal(recent?.source, "recent");
  assert.ok(
    resolveProductLookup(address, "issuer", "recent")?.href.includes("issuer="),
  );
  assert.ok(
    resolveProductLookup(address, "wallet", "recent")?.href.includes(
      "recipient=",
    ),
  );
});
