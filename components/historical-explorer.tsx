import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, CopyButton } from "./scan-ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { usePreferences } from "@/lib/preferences";
import { backendNetwork } from "@/lib/data-source";
import { short, NETWORK, SCHEMAS } from "@/lib/giwa";
import { schemaTitle, displayDate } from "@/lib/explorer-presentation";
import {
  ExplorerSearch,
  AddressIdentity,
  LoadingRecords,
} from "./explorer-presentation";
import {
  createHistoricalClient,
  HistoricalError,
  historicalReason,
  type HistoricalPage,
  type HistoricalCoverage,
  type HistoricalFilters,
} from "@/lib/historical-api";
const client = createHistoricalClient(backendNetwork);
export default function HistoricalExplorer() {
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const [coverage, setCoverage] = useState<HistoricalCoverage>();
  const [page, setPage] = useState<HistoricalPage>();
  const [draft, setDraft] = useState<HistoricalFilters>({});
  const [filters, setFilters] = useState<HistoricalFilters>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<HistoricalPage>();
  const [selected, setSelected] = useState("");
  const [detailError, setDetailError] = useState("");
  const seq = useRef(0),
    detailSeq = useRef(0);
  const explain = (e: unknown) =>
    e instanceof HistoricalError && e.status === 400
      ? t(
          "검색 형식 오류 · UID/스키마 32바이트, 발행자 주소 20바이트",
          "Invalid query · UID/schema: 32 bytes; issuer address: 20 bytes",
        )
      : e instanceof HistoricalError && e.status === 409
        ? t(
            "저장 데이터 변경 · 첫 페이지 재조회 필요",
            "Snapshot changed · reload the first page",
          )
        : t(
            "과거 데이터 API에 연결할 수 없습니다. 데이터가 없다는 뜻이 아닙니다.",
            "Historical API unavailable. This does not mean the data is absent.",
          );
  async function load(f: HistoricalFilters = filters, cursor?: string) {
    const n = ++seq.current;
    setBusy(true);
    setError("");
    setPage(undefined);
    try {
      const [c, p] = await Promise.all([
        client.coverage(),
        client.events(f, cursor),
      ]);
      if (n !== seq.current) return;
      if (c.meta.snapshot !== p.meta.snapshot)
        throw new HistoricalError(409, "CURSOR_SNAPSHOT_CHANGED");
      setCoverage(c);
      setPage(p);
      setFilters(f);
    } catch (e) {
      if (n === seq.current) {
        setCoverage(undefined);
        setError(explain(e));
      }
    } finally {
      if (n === seq.current) setBusy(false);
    }
  }
  async function lookup(uid: string, cursor?: string) {
    const n = ++detailSeq.current;
    setSelected(uid);
    setDetail(undefined);
    setDetailError("");
    const u = new URL(location.href);
    u.searchParams.set("uid", uid);
    history.replaceState(null, "", u);
    try {
      const p = await client.uid(uid, cursor);
      if (n === detailSeq.current) setDetail(p);
    } catch (e) {
      if (n === detailSeq.current) setDetailError(explain(e));
    }
  }
  useEffect(() => {
    void load({});
    const uid = new URLSearchParams(location.search).get("uid");
    if (uid) void lookup(uid);
    return () => {
      seq.current++;
      detailSeq.current++;
    };
  }, []);
  const label = (e: string) =>
    ({
      Attested: t("발급", "Issued"),
      Revoked: t("철회", "Revoked"),
      AttestationIndexed: t("Indexer 기록", "Indexer event"),
    })[e] ?? e;
  function events(p: HistoricalPage) {
    return (
      <div className="backend-list historical-events">
        {p.data.map((e) => (
          <article className="explorer-event" key={e.id}>
            <div
              className={`explorer-event-mark event-${e.event}`}
              aria-hidden="true"
            >
              {e.event === "Attested"
                ? "+"
                : e.event === "Revoked"
                  ? "−"
                  : "↗"}
            </div>
            <div className="explorer-event-main">
              <div className="explorer-event-heading">
                <span>{label(e.event)}</span>
                <Badge>
                  {e.receiptVerified
                    ? t("Receipt 검증 완료", "Receipt verified")
                    : t("로그 수집", "Log collected")}
                </Badge>
              </div>
              <h3>
                {e.uid ? (
                  <button onClick={() => void lookup(e.uid!)}>
                    {schemaTitle(e.schema, ko)} <span>↗</span>
                  </button>
                ) : (
                  t("계약 변경 기록", "Contract event")
                )}
              </h3>
              <dl className="explorer-card-facts">
                <div>
                  <dt>{t("발행자", "Issuer")}</dt>
                  <dd>
                    {e.issuer ? (
                      <AddressIdentity value={e.issuer} />
                    ) : (
                      t("이 이벤트에 없음", "Not in this event")
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t("수신자", "Recipient")}</dt>
                  <dd>
                    {e.recipient ? (
                      <AddressIdentity value={e.recipient} />
                    ) : (
                      t("이 이벤트에 없음", "Not in this event")
                    )}
                  </dd>
                </div>
              </dl>
              <p className="explorer-hint">
                {t("발생 블록", "Event block")} #
                {e.blockNumber.toLocaleString()} ·{" "}
                {t(
                  "과거 이벤트 · 현재 상태와 별개",
                  "Past event · separate from current status",
                )}
              </p>
              <details className="explorer-technical">
                <summary>
                  {t(
                    "기록 식별자와 거래",
                    "Record identifiers and transaction",
                  )}
                </summary>
                <dl className="backend-facts">
                  {e.uid && (
                    <div>
                      <dt>UID</dt>
                      <dd>
                        {e.uid}
                        <CopyButton
                          value={e.uid}
                          label={t("UID 복사", "Copy UID")}
                        />
                      </dd>
                    </div>
                  )}
                  {e.schema && (
                    <div>
                      <dt>{t("스키마 UID", "Schema UID")}</dt>
                      <dd>{e.schema}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Transaction</dt>
                    <dd>
                      <a
                        href={`${NETWORK.explorer}/tx/${e.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {short(e.transactionHash)} ↗
                      </a>
                      <CopyButton
                        value={e.transactionHash}
                        label={t("거래 해시 복사", "Copy transaction hash")}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Block hash</dt>
                    <dd>
                      {e.blockHash}
                      <CopyButton
                        value={e.blockHash}
                        label={t("블록 해시 복사", "Copy block hash")}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Log index</dt>
                    <dd>{e.logIndex}</dd>
                  </div>
                  {e.indexKey && (
                    <div>
                      <dt>Indexer key</dt>
                      <dd>
                        {e.indexKey}
                        <CopyButton
                          value={e.indexKey}
                          label={t("Indexer 키 복사", "Copy Indexer key")}
                        />
                      </dd>
                    </div>
                  )}
                </dl>
              </details>
            </div>
          </article>
        ))}
      </div>
    );
  }
  function empty(p: HistoricalPage) {
    return (
      p.data.length === 0 && (
        <div className="explorer-empty">
          <h3>{t("조건에 맞는 기록이 없습니다", "No matching records")}</h3>
          <p>
            {t(
              "현재 필터와 수집 범위 내 일치 이벤트가 없습니다. 미발급을 의미하지 않습니다.",
              "No matching events within the filters and collected scope. This does not prove non-issuance.",
            )}
          </p>
        </div>
      )
    );
  }
  return (
    <>
      <ExplorerSearch
        busy={busy}
        onSearch={(kind, value) => {
          if (kind === "uid") void lookup(value);
          else {
            const f = { [kind]: value };
            setDraft(f);
            void load(f);
          }
        }}
      />
      <p className="explorer-context">
        {t(
          "Historical · 보관된 발급·철회·Indexer 기록입니다. 과거 이벤트로 현재 유효성을 판단하지 않습니다.",
          "Historical · stored issuance, revocation and Indexer events. Past events do not establish current validity.",
        )}
      </p>
      <h2 className="explorer-results-title">
        {t("도장의 과거 기록", "Attestation history")}
      </h2>
      <form
        className="filters-row backend-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load(draft);
        }}
      >
        {(["uid", "schema", "issuer"] as const).map((k) => (
          <label key={k}>
            {k === "uid"
              ? "UID"
              : k === "schema"
                ? t("스키마", "Schema")
                : t("발행자", "Issuer")}
            <input
              placeholder={
                k === "uid"
                  ? "0x…"
                  : k === "schema"
                    ? t("전체 종류", "All types")
                    : t("전체 발행자", "All issuers")
              }
              list={k === "schema" ? "historical-schemas" : undefined}
              aria-label={`Historical ${k}`}
              value={draft[k] ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, [k]: e.target.value.trim().toLowerCase() })
              }
            />
          </label>
        ))}
        <datalist id="historical-schemas">
          {SCHEMAS.map((s) => (
            <option key={s.uid} value={s.uid}>
              {ko ? s.label : s.name}
            </option>
          ))}
        </datalist>
        <label>
          {t("이벤트 종류", "Event type")}
          <select
            aria-label="Historical event"
            value={draft.event ?? ""}
            onChange={(e) => setDraft({ ...draft, event: e.target.value })}
          >
            <option value="">{t("전체", "All")}</option>
            {["Attested", "Revoked", "AttestationIndexed"].map((x) => (
              <option key={x} value={x}>
                {label(x)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {t("필터 적용", "Apply filters")}
        </button>
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
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          aria-label="Refresh historical"
        >
          <RefreshCw size={16} />
        </button>
      </form>
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
      {busy && <LoadingRecords ko={ko} />}
      {page && (
        <>
          <p className="explorer-hint" role="status">
            {t("현재 페이지", "On this page")}: {page.data.length}{" "}
            {t(
              "개 이벤트 · 전체 도장 수가 아닙니다",
              "events · not the total attestation count",
            )}
          </p>
          {empty(page)}
          {events(page)}
          <div className="record-pagination">
            <button disabled={busy} onClick={() => void load()}>
              {t("처음", "First page")}
            </button>
            <button
              disabled={!page.next || busy}
              onClick={() => void load(filters, page.next!)}
            >
              {t("다음", "Next page")}
            </button>
          </div>
        </>
      )}
      {coverage && (
        <section className="records-panel backend-coverage">
          <div className="section-heading bare">
            <h2>{t("과거 수집 범위", "Historical coverage")}</h2>
            <Badge>{t("부분 이력", "Partial history")}</Badge>
          </div>
          <p className="explorer-hint">
            {t(
              "검색한 범위와 거래 기록까지 검증한 블록은 서로 다릅니다. 전체 역사나 현재 자격 판단을 보장하지 않습니다.",
              "Searched ranges differ from receipt-verified blocks. Neither establishes full history or current eligibility.",
            )}
          </p>
          <div className="explorer-metrics">
            <div>
              <span>{t("로그 검색 범위", "Log discovery")}</span>
              <strong>
                {coverage.discovery
                  .reduce((n, r) => n + r.through - r.from + 1, 0)
                  .toLocaleString()}{" "}
                {t("블록", "blocks")}
              </strong>
            </div>
            <div>
              <span>{t("Receipt 검증", "Receipt-verified")}</span>
              <strong>
                {coverage.receiptVerifiedBlocks.length.toLocaleString()}{" "}
                {t("블록", "blocks")}
              </strong>
            </div>
            <div>
              <span>{t("발견된 도장 UID", "Discovered UIDs")}</span>
              <strong>{coverage.summary.uniqueUIDs.toLocaleString()}</strong>
            </div>
          </div>
          <p className="explorer-observation">
            {t("관측 시각", "Observed at")}:{" "}
            {displayDate(coverage.meta.observedAt, ko)}
          </p>
          <details className="explorer-technical">
            <summary>
              {t(
                "수집 범위와 미확인 근거",
                "Collection scope and missing evidence",
              )}
            </summary>
            <dl className="backend-facts">
              <div>
                <dt>Discovery</dt>
                <dd>
                  {coverage.discovery
                    .reduce((n, r) => n + r.through - r.from + 1, 0)
                    .toLocaleString()}{" "}
                  {t("블록", "blocks")}
                </dd>
              </div>
              <div>
                <dt>{t("Receipt 검증 완료 블록", "Receipt-verified blocks")}</dt>
                <dd>
                  {coverage.receiptVerifiedBlocks.length.toLocaleString()} ·{" "}
                  {t("연속 Raw coverage 아님", "not continuous Raw coverage")}
                </dd>
              </div>
              <div>
                <dt>UID / Payload</dt>
                <dd>
                  {coverage.summary.uniqueUIDs.toLocaleString()} /{" "}
                  {coverage.summary.payloads.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>{t("이벤트", "Events")}</dt>
                <dd>
                  {Object.entries(coverage.summary.events)
                    .map(([k, n]) => `${label(k)} ${n.toLocaleString()}`)
                    .join(" · ")}
                </dd>
              </div>
              <div>
                <dt>{t("관측 시각", "Observed at")}</dt>
                <dd>{coverage.meta.observedAt}</dd>
              </div>
              <div>
                <dt>
                  {t(
                    "독립 Backfill checkpoint",
                    "Independent Backfill checkpoint",
                  )}
                </dt>
                <dd>{coverage.checkpoint.nextBlock.toLocaleString()}</dd>
              </div>
            </dl>
            <details>
              <summary>{t("발견 범위 보기", "View discovered ranges")}</summary>
              <ul>
                {coverage.discovery.map((r) => (
                  <li key={r.from}>
                    {r.from.toLocaleString()}–{r.through.toLocaleString()}
                  </li>
                ))}
              </ul>
            </details>
            <p>
              {t(
                "Book 이벤트 0건은 전체 역사에서 변경이 없었다는 증거가 아닙니다. 초기 상태와 현재 자격 판단은 UNKNOWN입니다.",
                "Zero Book events do not prove no changes across history. Initial state and current eligibility remain UNKNOWN.",
              )}
            </p>
            <details>
              <summary>
                {t("미확인 증거 항목", "Unresolved evidence")}
              </summary>
              <p>
                {t("기존 발급 증거 재사용", "Reused issuance proofs")}:{" "}
                {coverage.summary.existingProofs}
              </p>
              <ul>
                {Object.entries(coverage.summary.unknownReasons).map(
                  ([r, n]) => (
                    <li key={r}>
                      {historicalReason(r, ko)}: {n.toLocaleString()}
                    </li>
                  ),
                )}
              </ul>
            </details>
          </details>
        </section>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            detailSeq.current++;
            setSelected("");
            setDetail(undefined);
            const u = new URL(location.href);
            u.searchParams.delete("uid");
            history.replaceState(null, "", u);
          }
        }}
      >
        <SheetContent className="backend-detail">
          <SheetHeader>
            <SheetTitle>
              {t("과거 UID 이력", "Historical UID history")}
            </SheetTitle>
            <SheetDescription>
              {t(
                "발급 당시 증거와 관측된 이벤트이며 현재 자격 판단은 UNKNOWN입니다.",
                "Issuance evidence and observed events; current eligibility is UNKNOWN.",
              )}
            </SheetDescription>
          </SheetHeader>
          <p className="explorer-detail-actions">
            <code title={selected}>UID {short(selected)}</code>
            <CopyButton value={selected} label={t("UID 복사", "Copy UID")} />
            <span>
              {t("공유", "Share")}
              <CopyButton
                value={location.href}
                label={t("링크 복사", "Copy link")}
              />
            </span>
          </p>
          {detailError ? (
            <p className="notice danger" role="alert">
              {detailError}
            </p>
          ) : !detail ? (
            <p>{t("조회 중…", "Loading…")}</p>
          ) : (
            <>
              {detail.issuanceEvidence ? (
                <>
                  <section className="explorer-detail-hero">
                    <h2>
                      {schemaTitle(
                        String(detail.issuanceEvidence.payload.schema ?? ""),
                        ko,
                      )}
                    </h2>
                    <Badge>
                      {detail.issuanceEvidence.proofComplete
                        ? t(
                            "기존 발급 증거 검증 완료",
                            "Existing issuance evidence verified",
                          )
                        : t(
                            "발급 증거 미확인 · UNKNOWN",
                            "Unresolved issuance evidence · UNKNOWN",
                          )}
                    </Badge>
                    <p>
                      {t(
                        "현재 이용 자격은 UNKNOWN입니다. 과거 발급 근거가 있어도 현재 접근을 허가하지 않습니다.",
                        "Current eligibility is UNKNOWN. Past issuance evidence does not grant current access.",
                      )}
                    </p>
                  </section>
                  <section className="explorer-detail-section">
                    <h3>{t("저장된 발급 정보", "Stored issuance details")}</h3>
                    <dl className="backend-facts">
                      {(["attester", "recipient"] as const).map((k) => (
                        <div key={k}>
                          <dt>
                            {k === "attester"
                              ? t("발행자", "Issued by")
                              : t("수신자", "Issued to")}
                          </dt>
                          <dd>
                            {typeof detail.issuanceEvidence!.payload[k] ===
                            "string" ? (
                              <AddressIdentity
                                value={String(
                                  detail.issuanceEvidence!.payload[k],
                                )}
                                full
                              />
                            ) : (
                              t("미확인", "Unknown")
                            )}
                          </dd>
                        </div>
                      ))}
                      <div>
                        <dt>{t("발급 시각", "Issued at")}</dt>
                        <dd>
                          {displayDate(
                            String(detail.issuanceEvidence.payload.time ?? ""),
                            ko,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("만료 시각", "Expires at")}</dt>
                        <dd>
                          {String(
                            detail.issuanceEvidence.payload.expirationTime,
                          ) === "0"
                            ? t("만료 시각 없음", "No expiration time")
                            : displayDate(
                                String(
                                  detail.issuanceEvidence.payload
                                    .expirationTime ?? "",
                                ),
                                ko,
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {t("철회 기록 시각", "Recorded revocation time")}
                        </dt>
                        <dd>
                          {String(
                            detail.issuanceEvidence.payload.revocationTime,
                          ) === "0"
                            ? t(
                                "이 관측에서는 철회 시각 없음",
                                "No revocation time in this observation",
                              )
                            : displayDate(
                                String(
                                  detail.issuanceEvidence.payload
                                    .revocationTime ?? "",
                                ),
                                ko,
                              )}
                        </dd>
                      </div>
                    </dl>
                    <p className="explorer-hint">
                      {t("관측 기준", "Observation reference")}:{" "}
                      {detail.issuanceEvidence.observation.atIssuance
                        ? t("발급 블록", "Issuance block")
                        : t("별도 저장 관측값", "Separate stored observation")}
                      .{" "}
                      {t(
                        "현재 철회·만료 여부와는 별개입니다.",
                        "Separate from current revocation or expiry.",
                      )}
                    </p>
                  </section>
                  <details className="explorer-technical">
                    <summary>
                      {t(
                        "미확인 항목 및 원본 데이터",
                        "Unresolved items and source data",
                      )}
                    </summary>
                    <ul>
                      {detail.issuanceEvidence.unknownReasons.map((r) => (
                        <li key={r}>{historicalReason(r, ko)}</li>
                      ))}
                    </ul>
                    <details>
                      <summary>
                        {t("저장된 Payload 원문", "Stored payload")}
                      </summary>
                      <pre className="historical-hash">
                        {JSON.stringify(
                          detail.issuanceEvidence.payload,
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </details>
                </>
              ) : (
                <p>
                  {t(
                    "이 UID의 발급 Payload는 저장 범위에서 확보되지 않았습니다.",
                    "Issuance payload for this UID is not available in the stored scope.",
                  )}
                </p>
              )}
              <h3 className="explorer-results-title">
                {t("관측된 이벤트", "Observed events")}
              </h3>
              {empty(detail)}
              {events(detail)}
              <button
                disabled={!detail.next}
                onClick={() => void lookup(selected, detail.next!)}
              >
                {t("다음 이력", "Next events")}
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
