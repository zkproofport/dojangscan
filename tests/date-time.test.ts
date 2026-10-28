import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDateFormatter,
  formatDateTime,
  validTimeZone,
} from "../lib/date-time";

test("Unix seconds and ISO snapshots show the same local time with an explicit offset", () => {
  const iso = "2026-10-27T08:49:40Z";
  const time = Date.parse(iso) / 1000;
  const korean = formatDateTime(time, "Asia/Seoul", "ko-KR");
  assert.equal(korean, formatDateTime(iso, "Asia/Seoul", "ko-KR"));
  assert.match(korean, /17:49:40/);
  assert.match(korean, /GMT\+9/);
  assert.match(formatDateTime(time, "America/New_York", "ko-KR"), /04:49:40/);
  assert.match(formatDateTime(time, "America/New_York", "en-US"), /GMT-4/);
  assert.equal(formatDateTime("invalid"), "—");
});

test("calendar dates follow the target timezone across midnight and daylight saving transitions", () => {
  const seoul = calendarDateFormatter("Asia/Seoul");
  const newYork = calendarDateFormatter("America/New_York");
  const unix = (iso: string) => Date.parse(iso) / 1000;
  assert.equal(seoul(unix("2026-10-27T15:00:00Z")), "2026-10-28");
  assert.equal(newYork(unix("2026-03-09T03:59:59Z")), "2026-03-08");
  assert.equal(newYork(unix("2026-03-09T04:00:00Z")), "2026-03-09");
  assert.equal(newYork(unix("2026-11-02T04:59:59Z")), "2026-11-01");
  assert.equal(newYork(unix("2026-11-02T05:00:00Z")), "2026-11-02");
  assert.equal(validTimeZone("Asia/Seoul"), true);
  assert.equal(validTimeZone("Not/AZone"), false);
});
