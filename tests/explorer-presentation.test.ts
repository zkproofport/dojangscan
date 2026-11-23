import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayDate,
  observationIsOld,
  resolveExplorerSearch,
  schemaTitle,
} from "../lib/explorer-presentation";
import { SCHEMAS } from "../lib/giwa";

test("search supports Korean/English catalog names without treating them as identity proof", () => {
  for (const schema of SCHEMAS) {
    assert.deepEqual(resolveExplorerSearch(schema.label, "schema"), {
      kind: "schema",
      value: schema.uid,
    });
    assert.deepEqual(
      resolveExplorerSearch(` ${schema.name.toUpperCase()} `, "uid"),
      { kind: "schema", value: schema.uid },
    );
    assert.equal(resolveExplorerSearch(schema.name, "issuer"), null);
  }
});
test("ambiguous 32-byte identifiers require the selected search type; no automatic public lookup", () => {
  const uid = "0x" + "a".repeat(64);
  assert.deepEqual(resolveExplorerSearch(uid, "uid"), {
    kind: "uid",
    value: uid,
  });
  assert.deepEqual(resolveExplorerSearch(uid, "schema"), {
    kind: "schema",
    value: uid,
  });
  assert.equal(resolveExplorerSearch(uid, "issuer"), null);
  assert.equal(resolveExplorerSearch("0x" + "a".repeat(40), "uid"), null);
  assert.deepEqual(resolveExplorerSearch("0x" + "A".repeat(40), "issuer"), {
    kind: "issuer",
    value: "0x" + "a".repeat(40),
  });
  assert.deepEqual(
    resolveExplorerSearch(" 0x" + "A".repeat(40) + " ", "recipient"),
    {
      kind: "recipient",
      value: "0x" + "a".repeat(40),
    },
  );
  assert.equal(resolveExplorerSearch(uid, "recipient"), null);
});
test("invalid search cannot become an unfiltered query or an arbitrary URL", () => {
  for (const value of [
    "",
    " ",
    "0x123",
    "https://example.com",
    "unknown schema",
    "0x" + "g".repeat(64),
  ]) {
    for (const kind of ["uid", "schema", "issuer", "recipient"] as const)
      assert.equal(resolveExplorerSearch(value, kind), null);
  }
});
test("unknown schema has no invented name or verification claim", () => {
  assert.equal(
    schemaTitle(SCHEMAS[0].uid.toUpperCase(), true),
    SCHEMAS[0].label,
  );
  assert.equal(schemaTitle(SCHEMAS[0].uid, false), SCHEMAS[0].name);
  assert.equal(
    schemaTitle("0x" + "9".repeat(64), false),
    "Unknown schema name",
  );
  assert.equal(schemaTitle(null, true), "스키마 이름 미확인");
});
test("Unix seconds and ISO timestamps have the same explicit KST representation", () => {
  const iso = "2026-11-20T03:00:00Z";
  for (const ko of [true, false]) {
    assert.equal(
      displayDate(String(Date.parse(iso) / 1000), ko),
      displayDate(iso, ko),
    );
    assert.match(displayDate(iso, ko), /KST$/);
    assert.equal(displayDate(null, ko), ko ? "시각 미확인" : "Time unknown");
    assert.equal(
      displayDate("invalid", ko),
      ko ? "시각 미확인" : "Time unknown",
    );
  }
});
test("observation freshness treats missing time as unknown and uses a disclosed 15-minute threshold", () => {
  const now = Date.parse("2026-11-20T03:00:00Z");
  assert.equal(observationIsOld("2026-11-20T02:45:00Z", now), false);
  assert.equal(observationIsOld("2026-11-20T02:44:59Z", now), true);
  assert.equal(observationIsOld(null, now), true);
  assert.equal(observationIsOld("invalid", now), true);
});
