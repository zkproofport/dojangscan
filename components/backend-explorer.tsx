import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Download,
  Fingerprint,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
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
import "./backend-explorer.css";

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
function ErrorNotice({ error }: { error: unknown }) {
  const t = useText();
  const kind = backendErrorKind(error);
  return (
    <div className="notice danger" role="alert">
      {kind === "unknown"
        ? t(
            "UNKNOWN · 수집·평가 범위에서 확인할 수 없습니다. 발급되지 않았다는 뜻이 아닙니다.",
            "UNKNOWN · Not available within indexed/evaluated coverage. This does not prove non-issuance.",
          )
        : kind === "absent"
          ? t(
              "검증된 조회 범위에서 이 UID를 찾지 못했습니다.",
              "UID absent within the verified query coverage.",
            )
          : kind === "query"
            ? t(
                "검색 형식을 확인하세요. UID/스키마는 32바이트, 발행자는 20바이트 주소입니다.",
                "Check the query: UID/schema is 32 bytes; issuer is a 20-byte address.",
              )
            : t(
                "Backend 연결 또는 조회 실패 · 데이터 부재로 판단하지 않습니다. SSH 터널과 대상 instance를 확인하세요.",
                "Backend connection/query failed · This does not indicate missing data. Check the SSH tunnel and target instance.",
              )}
      {error instanceof BackendError && (
        <small>
          {" "}
          HTTP {error.status || "—"} · {error.code}
        </small>
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
        {meta.coverage.initialStateComplete ? t("확인됨", "Known") : "UNKNOWN"}{" "}
        · {t("전역 평가 준비", "Global evaluation ready")}:{" "}
        {String(meta.stateEvaluationReady)}.{" "}
        {t(
          "수집 범위의 평가 완료와 현재 서비스 접근 허가는 별개입니다. ALLOW는 비활성화되어 있습니다.",
          "Range evaluation does not authorize service access. ALLOW remains disabled.",
        )}
      </p>
    </section>
  );
}
function RecordStatus({ record }: { record: IndexedAttestation }) {
  const t = useText();
  const labels = {
    active: t("EAS 활성", "EAS active"),
    revoked: t("철회됨", "Revoked"),
    expired: t("만료됨", "Expired"),
    unknown: "UNKNOWN",
  };
  return (
    <Badge variant={record.status === "revoked" ? "danger" : "neutral"}>
      {labels[record.status]}
    </Badge>
  );
}
export default function BackendExplorer({
  publicSearch,
}: {
  publicSearch: () => void;
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
  const [display, setDisplay] = useState("cards");
  const [filters, setFilters] = useState<BackendFilters>({});
  const [draft, setDraft] = useState<BackendFilters>({});
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  async function load(nextFilters: BackendFilters = filters, cursor?: string) {
    const seq = ++sequence.current;
    setBusy(true);
    setError(null);
    setPage(null);
    setStatus(undefined);
    setStatusError(null);
    try {
      const result = await getData<{ page: BackendPage; reset: boolean }>(
        "backend-list",
        { ...nextFilters, limit: "6", ...(cursor ? { cursor } : {}) },
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
    history.replaceState(null, "", url);
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
    void load({});
    if (uid) void lookup(uid);
    return () => {
      sequence.current++;
      detailSequence.current++;
    };
  }, []);
  const items = page?.data.map(adaptProjection) ?? [];
  const schemaName = (schema: string) =>
    SCHEMAS.find((s) => s.uid.toLowerCase() === schema.toLowerCase())?.name ??
    short(schema);
  function close() {
    detailSequence.current++;
    setDetail(null);
    setDetailError(null);
    setDetailBusy(false);
    const url = new URL(location.href);
    url.searchParams.delete("uid");
    history.replaceState(null, "", url);
  }
  return (
    <>
      <p className="notice">
        {t(
          "NUC Backend · 지정된 instance의 저장 데이터입니다. 수집 범위 밖의 전체 이력은 아직 확인되지 않았습니다.",
          "NUC Backend · Stored data from the configured instance. Full history beyond the indexed range remains unverified.",
        )}{" "}
        <code>{backendNetwork}</code>
      </p>
      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(uid);
        }}
      >
        <Search size={20} />
        <input
          aria-label="Backend UID"
          placeholder={t("Backend UID 검색", "Search Backend UID")}
          value={uid}
          onChange={(e) => setUid(e.target.value)}
        />
        <button disabled={detailBusy}>{t("검색", "Search")}</button>
      </form>
      <button className="text-button" onClick={publicSearch}>
        {t(
          "트랜잭션·지갑 검색은 공개 RPC/Explorer에서 열기 ↗",
          "Open transaction / wallet search with public RPC/Explorer ↗",
        )}
      </button>
      {error != null && <ErrorNotice error={error} />}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">{t("Backend 조회 중…", "Reading Backend…")}</p>}
      <section className="records-workspace">
        <div className="section-heading bare">
          <h2>{t("수집된 도장", "Indexed attestations")}</h2>
          <div className="display-toggle">
            <button
              aria-label={t("카드 보기", "Card view")}
              onClick={() => setDisplay("cards")}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              aria-label={t("목록 보기", "List view")}
              onClick={() => setDisplay("list")}
            >
              <List size={17} />
            </button>
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
        <form
          className="filters-row backend-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void load(draft);
          }}
        >
          <label>
            {t("스키마 UID", "Schema UID")}
            <input
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
          <label>
            {t("발행자 주소", "Issuer address")}
            <input
              aria-label="Backend issuer filter"
              value={draft.issuer ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  issuer: e.target.value.trim().toLowerCase(),
                })
              }
            />
          </label>
          <button disabled={busy}>{t("필터 적용", "Apply filters")}</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft({});
              void load({});
            }}
          >
            {t("초기화", "Reset")}
          </button>
        </form>
        <p className="fine-print">
          {t("현재 서버 페이지의 기록 수", "Records on this server page")}:{" "}
          {items.length} ·{" "}
          {t(
            "전체 GIWA 발급량이 아닙니다. 수신자 필터는 API 미지원입니다.",
            "Not the total GIWA issuance count. Recipient filtering is not supported by this API.",
          )}
        </p>
        {page && !items.length && (
          <p className="notice">
            {t(
              "이 조회 범위와 필터에서 반환된 기록이 없습니다. 전체 체인의 부재를 뜻하지 않습니다.",
              "No returned records for this coverage and filter. This is not proof of absence across the chain.",
            )}
          </p>
        )}
        <div
          className={display === "cards" ? "credential-grid" : "backend-list"}
        >
          {items.map((record) => (
            <article className="credential-card" key={record.uid}>
              <div className="credential-top">
                <span className="record-origin">
                  <Fingerprint size={18} />
                  {record.projection.classification ?? "UNKNOWN"}
                </span>
                <RecordStatus record={record} />
              </div>
              <div className="credential-body">
                <h3>{schemaName(record.schema)}</h3>
                <code title={record.uid}>{short(record.uid)}</code>
                <CopyButton value={record.uid} />
              </div>
              <div className="credential-issuer">
                <span>{t("발행자", "Issuer")}</span>
                <code title={record.attester}>{short(record.attester)}</code>
              </div>
              <div className="credential-recipient">
                <span>{t("수신자", "Recipient")}</span>
                <code title={record.recipient}>{short(record.recipient)}</code>
              </div>
              <div className="credential-bottom">
                <span>#{number(page?.meta.asOfBlock)}</span>
                <button
                  className="record-open"
                  aria-label={`UID ${record.uid}`}
                  onClick={() => void lookup(record.uid)}
                >
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="record-pagination">
          <button disabled={busy} onClick={() => void load()}>
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
      {page && (
        <>
          <p className="fine-print">
            {t("목록 snapshot 기준", "List snapshot reference")}: #
            {number(page.meta.asOfBlock)} · {time(page.meta.observedAt)}
          </p>
          {status && (
            <p className="fine-print">
              {t(
                "아래 수집 상태는 별도 GET의 관측값입니다. 수집 진행 중 목록과 기준 블록이 다를 수 있습니다.",
                "The coverage below is a separate status observation and may advance beyond the list snapshot.",
              )}
            </p>
          )}
          <BackendCoverage meta={status?.meta ?? page.meta} status={status} />
        </>
      )}
      {statusError != null && (
        <>
          <p>
            {t("별도 head 상태 조회 실패", "Separate head status query failed")}
          </p>
          <ErrorNotice error={statusError} />
        </>
      )}
      <Sheet
        open={detailBusy || detail !== null || detailError !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent className="detail-sheet backend-detail">
          <SheetHeader>
            <SheetTitle>{t("도장 상세", "Attestation detail")}</SheetTitle>
            <SheetDescription>
              NUC Backend · GIWA Sepolia · {backendNetwork}
            </SheetDescription>
          </SheetHeader>
          {detailBusy && <p role="status">{t("조회 중…", "Loading…")}</p>}
          {detailError != null && (
            <>
              <ErrorNotice error={detailError} />
              {detailError instanceof BackendError && detailError.meta && (
                <BackendCoverage meta={detailError.meta} />
              )}
            </>
          )}
          {detail && <BackendRecordDetail detail={detail} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
function BackendRecordDetail({ detail }: { detail: BackendDetail }) {
  const t = useText();
  const p = detail.data;
  const record = adaptProjection(p);
  const tri = (v: TriState | undefined) =>
    v === true ? t("예", "Yes") : v === false ? t("아니요", "No") : "UNKNOWN";
  const unavailable = t(
    "API 미제공 · 확인 불가",
    "Not exposed by API · unknown",
  );
  return (
    <>
      <div className="filters-row">
        <RecordStatus record={record} />
        <Badge>Current Decision UNKNOWN</Badge>
        <CopyButton value={location.href} label="링크 복사" />
        <button onClick={() => downloadJSON(detail, `${p.uid}.json`)}>
          <Download size={16} /> JSON
        </button>
      </div>
      <p className="notice">
        {t(
          "EAS 활성은 인증·접근 허가를 뜻하지 않습니다. 이 화면은 ALLOW를 발행하지 않습니다.",
          "EAS active does not authorize access or certify identity. This screen never issues ALLOW.",
        )}
      </p>
      <Facts
        rows={[
          [
            "UID",
            <>
              {p.uid}
              <CopyButton value={p.uid} />
            </>,
          ],
          [t("스키마", "Schema"), p.schema],
          [t("발행자", "Issuer"), p.issuer],
          [t("수신자", "Recipient"), p.recipient],
          [t("발급 기록 존재", "Issuance record exists"), tri(p.issued)],
          [
            t("발급 이벤트 직접 수집", "Issuance event directly indexed"),
            tri(p.issuanceEventObserved),
          ],
          [t("발급 시각", "Issued at"), time(p.issuedAt)],
          [
            t("철회됨", "Revoked"),
            p.notRevoked == null ? "UNKNOWN" : tri(!p.notRevoked),
          ],
          [t("철회 시각", "Revoked at"), unavailable],
          [
            t("만료 시각", "Expires at"),
            p.expiresAt === "0"
              ? t("만료 시각 없음", "No expiration time")
              : time(p.expiresAt),
          ],
          ["refUID", unavailable],
          [
            "Indexer",
            record.indexStatus === "selected"
              ? t("관측 시 선택됨", "Selected at observation")
              : record.indexStatus === "not-selected"
                ? t(
                    "관측 시 미선택 · 철회와 별개",
                    "Not selected at observation · independent of revocation",
                  )
                : "UNKNOWN",
          ],
          [
            t("과거 평가 블록", "Historical evaluation block"),
            number(p.evaluatedBlock ?? detail.meta.evaluatedBlock),
          ],
          [
            t("관측 시 미만료", "Not expired at snapshot"),
            tri(p.snapshotNotExpired),
          ],
          [
            t("발급 당시 등록 발행자", "Registered issuer at issuance"),
            tri(p.issuerRegisteredAtIssuance),
          ],
          [
            t("현재 권한 승인", "Current authorization"),
            "UNKNOWN · ALLOW disabled",
          ],
          [t("분류", "Classification"), p.classification ?? "UNKNOWN"],
        ]}
      />
      <h3>{t("저장된 해석 필드", "Stored decoded fields")}</h3>
      <Facts rows={record.fields.map((f) => [f.name, f.value])} />
      <p className="notice">
        {t(
          "필드 값은 발행자의 기록입니다. Balance Merkle proof는 이 화면에서 독립 검증하지 않았습니다.",
          "Fields are issuer assertions. Balance Merkle proofs are not independently verified in this view.",
        )}
      </p>
      <h3>{t("평가 이유", "Evaluation reasons")}</h3>
      <ul>
        {p.reasons.map((reason, i) => (
          <li key={i}>
            <code>{reason}</code>
          </li>
        ))}
      </ul>
      <HistoricalSnapshots uid={p.uid} />
      <p>
        {t(
          "Indexer 선택 변경 이벤트의 전체 이력과 refUID는 API 미제공입니다. Snapshot의 미선택 상태를 철회로 해석하지 않습니다.",
          "Full Indexer selection event history and refUID are not exposed. A snapshot that is not selected is not treated as revoked.",
        )}
      </p>
      <BackendCoverage meta={detail.meta} />
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
            "현재 Live API는 반환된 projection의 평가 기준만 제공합니다. 전체 과거 전환 이력 endpoint는 아직 없습니다.",
            "The Live API exposes the returned projection and its evaluation reference. A full historical transition endpoint is not yet available.",
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
