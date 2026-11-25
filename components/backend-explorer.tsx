import { UIDConfirmation, OtherRecordPaths } from "./uid-confirmation";
import { recordKind, recordedHeadline } from "@/lib/record-presentation";
import { SourceJSON } from "./source-json";
import { addressURL } from "@/lib/record-navigation";
import { catalogView, projectionCategory } from "@/lib/record-catalog";
import { CatalogNavigation } from "./record-catalog";
import SourceContext from "./source-context";
import { writeRoute } from "@/lib/record-navigation";
import { useEffect, useRef, useState } from "react";
import {
  AddressRecordSearch,
  StoredRecordContext,
  EmptyStoredRecords,
} from "./stored-record-context";
import {
  ArrowUpRight,
  Download,
  Fingerprint,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Badge, CopyButton, getData } from "./scan-ui";
import { downloadJSON } from "./scan-detail";
import { usePreferences } from "@/lib/preferences";
import { SCHEMAS, short } from "@/lib/giwa";
import {
  normalizeBackendFilters,
  backendErrorKind,
  BackendError,
  type BackendDetail,
  type BackendMeta,
  type BackendPage,
  type BackendStatus,
  type BackendFilters,
  type BackendHistory,
  type TriState,
} from "@/lib/backend-api";
import {
  adaptProjection,
  type IndexedAttestation,
} from "@/lib/backend-adapter";
import { backendNetwork } from "@/lib/data-source";
import HistoricalExplorer from "./historical-explorer";
import {
  RecordOverview,
  RecordContentPreview,
  RecordObservation,
  RecordEvidence,
} from "./record-context";
import RelatedRecords from "./related-records";
import { RecordedContentPanel } from "./recorded-content";
import { isIssuerAddress } from "@/lib/product-experience";
import {
  ExplorerSearch,
  AddressIdentity,
  LoadingRecords,
} from "./explorer-presentation";
import { displayDate, observationIsOld } from "@/lib/explorer-presentation";

function useText() {
  const [language] = usePreferences();
  return (ko: string, en: string) => (language === "ko" ? ko : en);
}
function number(value: number | null | undefined) {
  return value == null ? "UNKNOWN" : value.toLocaleString();
}
function time(value: string | null | undefined) {
  if (!value) return "UNKNOWN";
  const date = /^\d+$/.test(value)
    ? new Date(Number(value) * 1000)
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "UNKNOWN";
}
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="backend-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  const t = useText();
  const kind = backendErrorKind(error);
  return (
    <div className="notice danger" role="alert">
      {kind === "unknown"
        ? t(
            "이 조회 범위에서는 확인할 수 없습니다. 발급되지 않았다는 뜻은 아닙니다.",
            "Not found within this collection. This does not prove non-issuance.",
          )
        : kind === "snapshot"
          ? t(
              "조회 기준 변경 · 첫 페이지 재조회 필요",
              "Snapshot changed · reload the first page",
            )
          : error instanceof BackendError && error.status === 503
            ? t(
                "저장된 기록 조회 서비스를 사용할 수 없습니다. 결과는 확인되지 않았습니다.",
                "Stored record service unavailable. No query result was established.",
              )
            : kind === "absent"
              ? t(
                  "검증된 조회 범위에서 이 UID를 찾지 못했습니다.",
                  "UID absent within the verified query coverage.",
                )
              : kind === "query"
                ? t(
                    "검색 형식 오류 · UID/스키마 32바이트, 수신자·발행자 주소 20바이트",
                    "Invalid query · UID/schema: 32 bytes; recipient/issuer: 20 bytes",
                  )
                : t(
                    "도장 기록 조회 실패 · 재조회 필요. 조회 실패는 기록 부재를 의미하지 않습니다.",
                    "Record lookup failed · retry required. Query failure does not establish record absence.",
                  )}
      {error instanceof BackendError && (
        <details className="explorer-technical">
          <summary>{t("오류 정보", "Error details")}</summary>
          <code>
            HTTP {error.status || "—"} · {error.code}
          </code>
        </details>
      )}
    </div>
  );
}
export function BackendCoverage({
  meta,
  status,
}: {
  meta: BackendMeta;
  status?: BackendStatus;
}) {
  const t = useText();
  const matching =
    status?.meta.network === meta.network &&
    status.meta.blockHash === meta.blockHash &&
    status.meta.projectionGeneration === meta.projectionGeneration;
  const head = matching
    ? (status?.operations?.finalizedHead ?? meta.finalizedHead)
    : meta.finalizedHead;
  const headAt =
    head?.observedAt ??
    (matching ? status?.operations?.headObservedAt : undefined);
  return (
    <section
      className="records-panel backend-coverage"
      aria-label="Backend coverage"
    >
      <div className="section-heading bare">
        <h2>{t("수집 범위", "Coverage")}</h2>
        <Badge>Current Decision UNKNOWN</Badge>
      </div>
      <p className="explorer-hint">
        {t(
          "수집된 범위에서 확인한 기록입니다. 전체 발급 이력이나 현재 접근 권한을 보장하지 않습니다.",
          "These records cover an indexed range, not the full issuance history or current access eligibility.",
        )}
      </p>
      <div className="explorer-metrics">
        <div>
          <span>{t("수집한 마지막 블록", "Last indexed block")}</span>
          <strong>{number(meta.asOfBlock)}</strong>
        </div>
        <div>
          <span>{t("평가한 마지막 블록", "Last evaluated block")}</span>
          <strong>{number(meta.evaluatedBlock)}</strong>
        </div>
        <div>
          <span>{t("이력 범위", "History scope")}</span>
          <strong>
            {meta.coverage.raw_complete
              ? t("Raw 수집 완료", "Raw complete")
              : t("부분 수집", "Partial")}
          </strong>
        </div>
      </div>
      <p className="explorer-observation">
        {t("저장 관측", "Stored observation")}:{" "}
        {displayDate(meta.observedAt, t("ko", "en") === "ko")}
        {observationIsOld(meta.observedAt) && (
          <span className="explorer-age">
            {t(
              "최신성 확인 필요 · 15분 초과 또는 시각 미확인",
              "Check freshness · over 15 min or time unknown",
            )}
          </span>
        )}
      </p>
      <details className="explorer-technical">
        <summary>
          {t(
            "수집 범위·검증 기준",
            "Collection scope and verification details",
          )}
        </summary>
        <p>
          GIWA Sepolia · <code>{meta.network}</code>
        </p>
        <Facts
          rows={[
            [
              "Indexed / Evaluated",
              `${number(meta.asOfBlock)} / ${number(meta.evaluatedBlock)}`,
            ],
            [
              t("조회 범위", "Query range"),
              `${number(meta.range.from)} – ${number(meta.range.through)}`,
            ],
            [
              t("검증된 수집 블록 수", "Certified indexed blocks"),
              number(meta.coverage.certifiedBlocks),
            ],
            [
              t("수집 관측 시각", "Indexed observation time"),
              time(meta.observedAt),
            ],
            [
              t("관측 finalized head", "Recorded finalized head"),
              number(head?.number),
            ],
            [t("Head 관측 시각", "Head observation time"), time(headAt)],
            [
              t("미분류 UID 존재", "Unclassified UIDs present"),
              meta.coverage.classificationUnknown == null
                ? "UNKNOWN"
                : String(meta.coverage.classificationUnknown),
            ],
            [
              t("API 응답 확인 시각", "API verification time"),
              time(meta.verifiedAt),
            ],
            [
              t("최신성", "Freshness"),
              t(
                "저장된 관측값 · 실시간 head 조회 아님",
                "Stored observation · not a live head query",
              ) + ` (${meta.freshness})`,
            ],
            [
              "Raw / Hydration / Evaluation",
              `${meta.range.requestedRangeComplete ? "✓" : "UNKNOWN"} / ${meta.coverage.hydration_complete ? "✓" : "UNKNOWN"} / ${meta.coverage.range_evaluation_ready ? "✓" : "UNKNOWN"}`,
            ],
            [
              t("대기 / 소진 작업", "Pending / exhausted jobs"),
              `${meta.coverage.pending} / ${meta.coverage.exhausted}`,
            ],
          ]}
        />
        <p className="notice">
          {t("전체 이력", "Full history")}:{" "}
          {meta.coverage.raw_complete
            ? t("Raw 완료", "Raw complete")
            : t("부분 이력", "Partial history")}{" "}
          · {t("초기 상태", "Initial state")}:{" "}
          {meta.coverage.initialStateComplete
            ? t("확인됨", "Known")
            : "UNKNOWN"}{" "}
          · {t("전역 평가 준비", "Global evaluation ready")}:{" "}
          {String(meta.stateEvaluationReady)}.{" "}
          {t(
            "수집 범위의 평가 완료와 현재 서비스 접근 허가는 별개입니다. ALLOW는 비활성화되어 있습니다.",
            "Range evaluation does not authorize service access. ALLOW remains disabled.",
          )}
        </p>
      </details>
    </section>
  );
}
function RecordStatus({ record }: { record: IndexedAttestation }) {
  const t = useText();
  const labels = {
    active: t("관측상 미철회·미만료", "No observed revocation or expiry"),
    revoked: t("철회됨", "Revoked"),
    expired: t("만료됨", "Expired"),
    unknown: t("미확인 · UNKNOWN", "UNKNOWN"),
  };
  return (
    <Badge variant={record.status === "revoked" ? "danger" : "neutral"}>
      {labels[record.status]}
    </Badge>
  );
}
export default function BackendExplorer(props: { publicSearch: () => void }) {
  const t = useText();
  const historySource = new URLSearchParams(location.search).get("history");
  const historical = historySource === "backfill";
  return (
    <div className="explorer-shell">
      {historySource === "recent" ? (
        <HistoricalExplorer key="recent" recent />
      ) : historical ? (
        <HistoricalExplorer key="history" />
      ) : (
        <BackendRecords {...props} />
      )}
    </div>
  );
}
export function BackendRecords({
  publicSearch,
  issuerMode = false,
  recipientMode = false,
}: {
  publicSearch: () => void;
  issuerMode?: boolean;
  recipientMode?: boolean;
}) {
  const t = useText();
  const [page, setPage] = useState<BackendPage | null>(null);
  const [status, setStatus] = useState<BackendStatus>();
  const [statusError, setStatusError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [uid, setUid] = useState(
    () => new URLSearchParams(location.search).get("uid") ?? "",
  );
  const [detail, setDetail] = useState<BackendDetail | null>(null);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const initialFilters: BackendFilters = Object.fromEntries(
    ["recipient", "issuer", "schema"].flatMap((k) => {
      const v = new URLSearchParams(location.search).get(k);
      return v ? [[k, v]] : [];
    }),
  );
  const [filters, setFilters] = useState<BackendFilters>(initialFilters);
  const [draft, setDraft] = useState<BackendFilters>(initialFilters);
  const addressMode = recipientMode || issuerMode;
  const addressKey = recipientMode ? "recipient" : "issuer";
  const [addressInput, setAddressInput] = useState(
    initialFilters[addressKey] ?? "",
  );
  const [queryError, setQueryError] = useState("");
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  async function load(nextFilters: BackendFilters = filters, cursor?: string) {
    if (addressMode && !isIssuerAddress(nextFilters[addressKey] ?? "")) {
      setQueryError(
        t(
          "조회할 주소를 입력해야 합니다.",
          "Enter an address to query records.",
        ),
      );
      return;
    }
    setQueryError("");
    const url = new URL(location.href);
    for (const key of ["recipient", "issuer", "schema"] as const) {
      if (nextFilters[key]?.trim())
        url.searchParams.set(key, nextFilters[key]!.trim().toLowerCase());
      else url.searchParams.delete(key);
    }
    if (cursor) url.searchParams.set("cursor", cursor);
    else url.searchParams.delete("cursor");
    writeRoute(url);
    setFilters(nextFilters);
    const seq = ++sequence.current;
    setBusy(true);
    setNotice("");
    setError(null);
    setPage(null);
    setStatus(undefined);
    setStatusError(null);
    try {
      nextFilters = normalizeBackendFilters(nextFilters);
      const result = await getData<{ page: BackendPage; reset: boolean }>(
        "backend-list",
        { ...nextFilters, limit: "20", ...(cursor ? { cursor } : {}) },
      );
      if (seq !== sequence.current) return;
      setPage(result.page);
      setFilters(nextFilters);
      setNotice(
        result.reset
          ? t(
              "데이터 snapshot이 갱신되어 첫 페이지로 돌아왔습니다.",
              "Snapshot changed. Returned to the first page.",
            )
          : "",
      );
      try {
        const s = await getData<BackendStatus>("backend-status");
        if (seq === sequence.current) setStatus(s);
      } catch (e) {
        if (seq === sequence.current) setStatusError(e);
      }
    } catch (e) {
      if (seq === sequence.current) setError(e);
    } finally {
      if (seq === sequence.current) setBusy(false);
    }
  }
  async function lookup(value: string) {
    value = value.trim();
    const seq = ++detailSequence.current;
    setDetailBusy(true);
    setDetailError(null);
    setDetail(null);
    setUid(value);
    const url = new URL(location.href);
    url.searchParams.set("uid", value);
    writeRoute(url);
    try {
      const result = await getData<BackendDetail>("backend-detail", {
        uid: value.trim(),
      });
      if (seq === detailSequence.current) setDetail(result);
    } catch (e) {
      if (seq === detailSequence.current) setDetailError(e);
    } finally {
      if (seq === detailSequence.current) setDetailBusy(false);
    }
  }
  useEffect(() => {
    if ((!addressMode || initialFilters[addressKey]) && !uid)
      void load(
        initialFilters,
        new URLSearchParams(location.search).get("cursor") ?? undefined,
      );
    if (uid) void lookup(uid);
    return () => {
      sequence.current++;
      detailSequence.current++;
    };
  }, []);
  const catalog = catalogView(
    typeof location === "undefined" ? "" : location.search,
  );
  const items =
    page?.data
      .filter((p) => projectionCategory(p) === catalog)
      .map(adaptProjection) ?? [];
  function close() {
    detailSequence.current++;
    setUid("");
    setDetail(null);
    setDetailError(null);
    setDetailBusy(false);
    const url = new URL(location.href);
    url.searchParams.delete("uid");
    writeRoute(url);
    if (!page && (!addressMode || initialFilters[addressKey]))
      void load(initialFilters);
  }
  if (uid)
    return (
      <section className="uid-result-page">
        <a className="uid-return" href="?view=home">
          {t("다른 UID 조회", "Look up another UID")}
        </a>
        {detailBusy && (
          <p role="status">
            {t("조회 중…", "Loading…")}
          </p>
        )}
        {detailError != null && (
          <div className="uid-lookup-error">
            <h1>
              {t(
                "이 범위에서 UID를 찾지 못했습니다",
                "UID not found in this scope",
              )}
            </h1>
            <ErrorNotice error={detailError} />
            <p>
              {t(
                "미발급이나 무효라는 뜻은 아닙니다. 같은 UID의 다른 조회 경로를 직접 선택할 수 있습니다.",
                "This does not prove non-issuance or invalidity. You can explicitly check this UID elsewhere.",
              )}
            </p>
            <OtherRecordPaths
              uid={uid}
              source="live"
              ko={t("ko", "en") === "ko"}
            />
          </div>
        )}
        {detail && (
          <UIDConfirmation
            live={detail}
            uid={uid}
            source="live"
            ko={t("ko", "en") === "ko"}
          />
        )}
      </section>
    );
  return (
    <>
      {addressMode ? (
        <AddressRecordSearch
          recipient={recipientMode}
          value={addressInput}
          busy={busy}
          onChange={setAddressInput}
          onSubmit={() => {
            const address = addressInput.trim().toLowerCase();
            if (!isIssuerAddress(address)) {
              setQueryError(
                t(
                  "주소 형식 오류 · 0x와 40자리 16진수가 필요합니다.",
                  "Invalid address · expected 0x and 40 hex characters.",
                ),
              );
              return;
            }
            const f = { [addressKey]: address };
            setDraft(f);
            void load(f);
          }}
        />
      ) : (
        <ExplorerSearch
          busy={busy || detailBusy}
          onSearch={(kind, value) => {
            if (kind === "uid") void lookup(value);
            else {
              const f = { [kind]: value };
              setDraft(f);
              void load(f);
            }
          }}
        />
      )}
      {queryError && (
        <p role="alert" className="notice danger">
          {queryError}
        </p>
      )}
      {error != null && (
        <div className="explorer-empty">
          <ErrorNotice error={error} />
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void load()}
          >
            {t("재조회", "Retry lookup")}
          </button>
        </div>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {busy && <LoadingRecords ko={t("ko", "en") === "ko"} />}
      {page && addressMode && (
        <div className="queried-address">
          <span>{t("조회한 주소", "Address queried")}</span>
          <AddressIdentity
            role={issuerMode ? "issuer" : "recipient"}
            value={filters[addressKey] ?? ""}
          />
          <CopyButton
            value={location.href}
            label={t("검색 링크 복사", "Copy search link")}
          />
        </div>
      )}
      {page && page.data.length === 0 && (
        <EmptyStoredRecords
          meta={page.meta}
          recipient={recipientMode}
          address={addressMode ? filters[addressKey] : undefined}
          filtered={Boolean(
            filters.schema ||
              (recipientMode && filters.issuer) ||
              (!addressMode && (filters.issuer || filters.recipient)),
          )}
          onClear={() => {
            const f = addressMode ? { [addressKey]: filters[addressKey] } : {};
            setDraft(f);
            void load(f);
          }}
          onEdit={() => {
            const input = document.querySelector<HTMLInputElement>(
              addressMode ? "#record-address" : ".explorer-search input",
            );
            input?.focus();
            input?.select();
          }}
          onPublic={() => {
            if (addressMode && filters[addressKey])
              location.href =
                "?view=wallet&source=public&address=" +
                encodeURIComponent(filters[addressKey]!);
            else publicSearch();
          }}
        />
      )}
      {page && page.data.length > 0 && (
        <section className="records-workspace">
          <div className="section-heading bare">
            <h2>
              {addressMode
                ? recipientMode
                  ? t("수신한 도장 기록", "Received records")
                  : t("발급한 도장 기록", "Issued records")
                : t("조회 기록", "Matching records")}{" "}
              <span className="result-page-count">
                {t("현재 페이지", "This page")} · {items.length}
              </span>
            </h2>
            <div className="display-toggle">
              <button
                aria-label={t("새로고침", "Refresh")}
                disabled={busy}
                onClick={() => void load()}
              >
                <RefreshCw size={17} />
              </button>
              <button
                aria-label={t("현재 페이지 JSON 저장", "Download page JSON")}
                disabled={!page}
                onClick={() => downloadJSON(page, "dojang-backend-page.json")}
              >
                <Download size={17} />
              </button>
            </div>
          </div>
          <CatalogNavigation current={catalog} ko={t("ko", "en") === "ko"} />
          <p className="activity-observation">
            {page.meta.freshness === "stale"
              ? t("최근 갱신 없음 · ", "No recent update · ")
              : ""}
            {t("관측 시각", "Observed at")}{" "}
            {displayDate(page.meta.observedAt, t("ko", "en") === "ko")}
          </p>
          <p className="result-scope">
            {t(
              "선택한 분류의 현재 페이지 결과입니다. 전체 수집 범위는 아닙니다.",
              "Selected category on this page, within partial coverage.",
            )}
          </p>
          {items.length === 0 && (
            <p className="catalog-empty">
              {t(
                "이 페이지에는 해당 분류의 기록이 없습니다. 다른 분류나 다음 페이지를 확인하세요.",
                "No records in this category on this page. Try another category or the next page.",
              )}
            </p>
          )}
          <details
            className="result-filters"
            key={String(
              Boolean(filters.schema || (recipientMode && filters.issuer)),
            )}
            open={
              Boolean(filters.schema || (recipientMode && filters.issuer)) ||
              undefined
            }
          >
            <summary>
              {issuerMode
                ? t("도장 종류 필터", "Filter by type")
                : t("도장 종류·발행자 필터", "Filter by type or issuer")}
            </summary>
            <form
              className="filters-row backend-filters"
              onSubmit={(e) => {
                e.preventDefault();
                void load(draft);
              }}
            >
              <label>
                {t("도장 종류", "Attestation type")}
                <input
                  list="explorer-schemas"
                  placeholder={t(
                    "전체 종류 · 스키마 UID",
                    "All types · schema UID",
                  )}
                  aria-label="Backend schema filter"
                  value={draft.schema ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      schema: e.target.value.trim().toLowerCase(),
                    })
                  }
                />
              </label>
              <datalist id="explorer-schemas">
                {SCHEMAS.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {t(s.label, s.name)}
                  </option>
                ))}
              </datalist>
              {!issuerMode && (
                <label>
                  {t("발행자 주소", "Issuer address")}
                  <input
                    placeholder={t("전체 발행자 · 0x…", "All issuers · 0x…")}
                    aria-label="Backend issuer filter"
                    readOnly={issuerMode}
                    value={draft.issuer ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        issuer: e.target.value.trim().toLowerCase(),
                      })
                    }
                  />
                </label>
              )}
              <button type="submit" disabled={busy}>
                {t("필터 적용", "Apply filters")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reset = addressMode
                    ? { [addressKey]: filters[addressKey] }
                    : {};
                  setDraft(reset);
                  void load(reset);
                }}
              >
                {t("초기화", "Reset")}
              </button>
            </form>
          </details>
          <ul className="issuance-list">
            {items.map((record) => (
              <li key={record.uid}>
                <div className="issuance-name">
                  <button onClick={() => void lookup(record.uid)}>
                    {recordKind(
                      record.schema,
                      record.uid,
                      t("ko", "en") === "ko",
                    )}
                  </button>
                  <span>
                    {record.projection.notRevoked === false
                      ? t("철회 기록 있음", "Revocation recorded")
                      : record.projection.notExpired === false
                        ? t("관측 시점에 만료", "Expired at observation")
                        : record.projection.issued === true
                          ? t("발급 확인", "Issuance confirmed")
                          : t("발급 여부 미확인", "Issuance unconfirmed")}
                  </span>
                  {record.fields.some(
                    (f) =>
                      !["salt", "proofs", "root", "codeHash"].includes(
                        f.name,
                      ) && !/^0x[0-9a-f]{64,}$/i.test(f.value),
                  ) && <RecordContentPreview fields={record.fields} />}
                </div>
                <div className="issuance-parties">
                  <span>
                    <small>{t("발행자", "Issuer")}</small>
                    <a href={addressURL(record.attester, "issuer", "live")}>
                      {short(record.attester, 4)}
                    </a>
                  </span>
                  <span>
                    <small>{t("수신자", "Recipient")}</small>
                    <a href={addressURL(record.recipient, "recipient", "live")}>
                      {/^0x0{40}$/i.test(record.recipient)
                        ? t("개별 수신자 없음", "No individual recipient")
                        : short(record.recipient, 4)}
                    </a>
                  </span>
                </div>
                <button
                  className="record-open"
                  onClick={() => void lookup(record.uid)}
                >
                  {t("상세 보기", "View record")}
                </button>
              </li>
            ))}
          </ul>
          <div className="record-pagination">
            <button disabled={busy || !page} onClick={() => void load()}>
              {t("첫 페이지", "First page")}
            </button>
            <button
              disabled={busy || !page?.next}
              onClick={() => void load(filters, page!.next!)}
            >
              {t("다음 페이지", "Next page")}
            </button>
          </div>
        </section>
      )}
      {page && (
        <>
          <details className="product-source-control">
            <summary>
              {t("수집·평가 범위 상세", "Collection and evaluation details")}
            </summary>
            <BackendCoverage meta={page.meta} status={status} />
          </details>
        </>
      )}
      {statusError != null && (
        <details className="product-source-control">
          <summary>
            {t(
              "추가 관측 정보 조회 실패",
              "Additional observation unavailable",
            )}
          </summary>
          <ErrorNotice error={statusError} />
        </details>
      )}
    </>
  );
}
function HistoricalSnapshots({ uid }: { uid: string }) {
  const t = useText();
  const [data, setData] = useState<BackendHistory | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(false);
    if (backendNetwork !== "giwa-sepolia-finalized21-r1") {
      setError(true);
      return;
    }
    void getData<BackendHistory>("backend-history", { uid })
      .then((result) => {
        if (live) setData(result);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [uid]);
  if (backendNetwork !== "giwa-sepolia-finalized21-r1")
    return (
      <section>
        <h3>{t("과거 평가 이력", "Historical evaluation history")}</h3>
        <p>
          {t(
            "이 도장의 전체 평가 변화는 아직 제공되지 않습니다. 아래 링크에서 별도로 수집된 발급·철회 이벤트를 확인할 수 있습니다.",
            "The full evaluation timeline is not available yet. The link below opens issuance and revocation events collected separately.",
          )}
        </p>
      </section>
    );

  return (
    <section>
      <h3>{t("과거 평가 Snapshot", "Historical evaluation snapshots")}</h3>
      <p className="fine-print">
        {t(
          "기존 Phase21 감사 API · 지정된 UID만 · 최신 33행 상한 · 전체 이력 아님",
          "Existing Phase21 audit API · allowlisted UIDs only · latest 33 rows maximum · not complete history",
        )}
      </p>
      {error ? (
        <p role="status">
          {t(
            "이 UID의 과거 평가 조회를 제공하지 않거나 조회에 실패했습니다. 현재 상세 결과와 별개입니다.",
            "Historical evaluation is unsupported or unavailable for this UID, independently of its current detail response.",
          )}
        </p>
      ) : !data ? (
        <p>{t("조회 중…", "Loading…")}</p>
      ) : (
        <>
          {data.data.length === 0 && (
            <p>
              {t(
                "반환된 과거 평가 없음 · 전체 이력 부재를 뜻하지 않음",
                "No returned historical evaluations · not proof of absent history",
              )}
            </p>
          )}
          {data.data.map((row, i) => (
            <div className="notice" key={`${row.block_hash}-${i}`}>
              <strong>#{row.block_number}</strong> · EAS{" "}
              {adaptProjection(row.value).status} · Indexer{" "}
              {adaptProjection(row.value).indexStatus}
              <br />
              {t("당시 policyAccepted", "Snapshot policyAccepted")}:{" "}
              {String(row.value.policyAccepted)} · Current Decision UNKNOWN
              <br />
              <code>{row.block_hash}</code>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
