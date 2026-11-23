import { useEffect, useRef, useState } from "react";
import {
  createHistoricalClient,
  HistoricalError,
  type HistoricalPage,
} from "@/lib/historical-api";
import { backendNetwork } from "@/lib/data-source";
import { usePreferences } from "@/lib/preferences";
import { EventTimeline } from "./record-context";

/** Explicit, separate Historical GET. Never changes or replaces the Live result. */
export default function RelatedRecords({ uid }: { uid: string }) {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const [page, setPage] = useState<HistoricalPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(() => {
    setPage(undefined);
    setError("");
    setBusy(false);
    return () => {
      sequence.current++;
    };
  }, [uid]);
  async function load(cursor?: string) {
    const n = ++sequence.current;
    const snapshot = page?.meta.snapshot;
    setBusy(true);
    setError("");
    setPage(undefined);
    try {
      const result = await createHistoricalClient(backendNetwork).uid(
        uid,
        cursor,
      );
      if (n !== sequence.current) return;
      if (cursor && snapshot && result.meta.snapshot !== snapshot)
        throw new HistoricalError(409, "CURSOR_SNAPSHOT_CHANGED");
      setPage(result);
    } catch (e) {
      if (n === sequence.current)
        setError(
          e instanceof HistoricalError
            ? `${e.status} · ${e.code}`
            : "CONNECTION_FAILED",
        );
    } finally {
      if (n === sequence.current) setBusy(false);
    }
  }
  return (
    <section className="record-section">
      <h3>{t("관련 기록", "Related records")}</h3>
      <p>
        {t(
          "별도 Historical 스냅샷에서 같은 UID의 발급·철회·Indexer 이벤트를 조회합니다. 현재 관측 상태와 합치지 않습니다.",
          "Retrieve issuance, revocation and Indexer events for this UID from a separate Historical snapshot. These do not replace the observed state above.",
        )}
      </p>
      <button
        className="secondary-button"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy
          ? t("조회 중", "Loading")
          : t("관련 과거 기록 조회", "Load related historical records")}
      </button>
      {error && (
        <div className="notice danger" role="alert">
          <p>
            {t(
              "관련 이력을 조회하지 못했습니다. 기록이 없다는 뜻이 아닙니다. 현재 도장 결과는 유지됩니다.",
              "Related history could not be loaded. This does not mean no records exist. The attestation result is unchanged.",
            )}
          </p>
          <code>{error}</code>
        </div>
      )}
      {page && (
        <>
          <EventTimeline page={page} uid={uid} />
          <button
            disabled={!page.next || busy}
            onClick={() => void load(page.next!)}
          >
            {t("다음 이력 페이지", "Next history page")}
          </button>
          <details>
            <summary>{t("이력 조회 기준", "History query reference")}</summary>
            <p>
              {t(
                "고정 과거 구간 · 전체 이력 아님",
                "Fixed historical scope · not complete history",
              )}
            </p>
            <code>{page.meta.snapshot}</code>
            <p>{page.meta.observedAt}</p>
          </details>
        </>
      )}
      <a
        className="text-button"
        href={`?view=explore&source=backend&history=backfill&uid=${encodeURIComponent(uid)}`}
      >
        {t(
          "과거 발급 증거·수집 범위 열기",
          "Open historical issuance evidence and coverage",
        )}{" "}
        ↗
      </a>
    </section>
  );
}
