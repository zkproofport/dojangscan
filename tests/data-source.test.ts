import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseDataSource } from "../lib/data-source";
test("explicit source selection works in either direction without automatic fallback", () => {
  assert.equal(chooseDataSource("public", "?source=backend"), "backend");
  assert.equal(chooseDataSource("backend", "?source=public"), "public");
  assert.equal(chooseDataSource("backend", "?source=invalid"), "backend");
  assert.equal(chooseDataSource(undefined, ""), "public");
});
