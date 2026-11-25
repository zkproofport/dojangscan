import { UIDConfirmation, OtherRecordPaths } from "./uid-confirmation";
import { recordedHeadline } from "@/lib/record-presentation";
import { SourceJSON } from "./source-json";
import { catalogView, issuanceReferences } from "@/lib/record-catalog";
import {
  CatalogNavigation,
  IssuanceList,
  RecordHistory,
} from "./record-catalog";
import { ActivityList, ActivityEvidence, activityTitle } from "./activity-list";
import SourceContext from "./source-context";
import { writeRoute } from "@/lib/record-navigation";
import {
  resolveProductLookup,
  isIssuerAddress,
} from "@/lib/product-experience";
import { RecordOverview } from "./record-context";
import { eventRecordFacts, eventQuery } from "@/lib/record-navigation";
import { RecordedContentPanel } from "./recorded-content";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { short } from "@/lib/giwa";
import { displayDate } from "@/lib/explorer-presentation";
import { LoadingRecords } from "./explorer-presentation";
import {
  createHistoricalClient,
  createRecentClient,
  HistoricalError,
  type HistoricalEvent,
  type HistoricalPage,
  type HistoricalCoverage,
  type HistoricalFilters,
} from "@/lib/historical-api";
export default function HistoricalExplorer({
  recent = false,
}: {
  recent?: boolean;
}) {
  const client = useMemo(
    () =>
      recent
        ? createRecentClient(backendNetwork)
        : createHistoricalClient(backendNetwork),
    [recent],
  );
  const [language] = usePreferences();
  const ko = language === "ko";
  const t = (a: string, b: string) => (ko ? a : b);
  const catalog = catalogView(
    typeof location === "undefined" ? "" : location.search,
    true,
  );
  const technical = catalog === "events" || !recent;
  const catalogUnavailable = recent && ["dojang", "eas"].includes(catalog);
  const [coverage, setCoverage] = useState<HistoricalCoverage>();
  const [page, setPage] = useState<HistoricalPage>();
  const [draft, setDraft] = useState<HistoricalFilters>({});
  const [filters, setFilters] = useState<HistoricalFilters>({});
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"recipient" | "issuer">("recipient");
  const [searchError, setSearchError] = useState("");
  const [viewedAt, setViewedAt] = useState<string>();
  const [pageCursor, setPageCursor] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<HistoricalPage>();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent>();
  const [selected, setSelected] = useState("");
  const [detailError, setDetailError] = useState("");
  const seq = useRef(0),
    detailSeq = useRef(0);
  const explain = (e: unknown) =>
    e instanceof HistoricalError && e.status === 400
      ? t(
          "검색 형식 오류 · UID/스키마 32바이트, 발행자·수신자 주소 20바이트",
          "Invalid query · UID/schema: 32 bytes; issuer/recipient: 20 bytes",
        )
      : e instanceof HistoricalError && e.status === 409
        ? t(
            "저장 데이터 변경 · 첫 페이지 재조회 필요",
            "Snapshot changed · reload the first page",
          )
        : t(
            recent
              ? "최근 이벤트 API에 연결할 수 없습니다. 데이터가 없다는 뜻이 아닙니다."
              : "과거 데이터 API에 연결할 수 없습니다. 데이터가 없다는 뜻이 아닙니다.",
            recent
              ? "Recent API unavailable. This does not mean the data is absent."
              : "Historical API unavailable. This does not mean the data is absent.",
          );
  async function load(f: HistoricalFilters = filters, cursor?: string) {
    if (!technical) f = { ...f, event: "Attested" };
    const u = new URL(location.href);
    if (recent) u.searchParams.set("catalog", catalog);
    for (const k of ["schema", "issuer", "recipient", "event"] as const) {
      if (f[k]) u.searchParams.set(k, f[k]!);
      else u.searchParams.delete(k);
    }
    if (f.uid) u.searchParams.set("filterUid", f.uid);
    else u.searchParams.delete("filterUid");
    if (cursor) u.searchParams.set("cursor", cursor);
    else u.searchParams.delete("cursor");
    writeRoute(u);
    setPageCursor(cursor);
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
      setViewedAt(new Date().toISOString());
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
    if (cursor) u.searchParams.set("detailCursor", cursor);
    else u.searchParams.delete("detailCursor");
    writeRoute(u);
    try {
      const p = await client.uid(uid, cursor);
      if (n === detailSeq.current) setDetail(p);
    } catch (e) {
      if (n === detailSeq.current) setDetailError(explain(e));
    }
  }
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const initial: HistoricalFilters = {};
    for (const k of ["recipient", "issuer", "schema", "event"] as const) {
      const v = query.get(k);
      if (v) initial[k] = v;
    }
    if (query.get("filterUid")) initial.uid = query.get("filterUid")!;
    setDraft(initial);
    setSearch(initial.uid ?? initial.issuer ?? initial.recipient ?? "");
    setRole(initial.issuer ? "issuer" : "recipient");
    if (!catalogUnavailable && !query.get("uid"))
      void load(initial, query.get("cursor") ?? undefined);
    const uid = query.get("uid");
    if (uid) void lookup(uid, query.get("detailCursor") ?? undefined);
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
    if (!technical)
      return (
        <IssuanceList
          records={issuanceReferences(p)}
          ko={ko}
          source={recent ? "recent" : "history"}
          onOpen={(uid) => void lookup(uid)}
        />
      );
    return (
      <ActivityList
        events={p.data}
        ko={ko}
        source={recent ? "recent" : "history"}
        onEvidence={(event) => setSelectedEvent(event)}
        onSelect={(event) => {
          if (event.uid) {
            setSelectedEvent(undefined);
            void lookup(event.uid);
          } else setSelectedEvent(event);
        }}
      />
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
  if (selected)
    return (
      <section className="uid-result-page">
        <a className="uid-return" href="?view=home">
          {t("다른 UID 조회", "Look up another UID")}
        </a>
        {detailError ? (
          <div className="uid-lookup-error">
            <h1>
              {t(
                "기록을 확인하지 못했습니다",
                "The record could not be confirmed",
              )}
            </h1>
            <p role="alert">{detailError}</p>
            <OtherRecordPaths
              uid={selected}
              source={recent ? "recent" : "history"}
              ko={ko}
            />
          </div>
        ) : !detail ? (
          <p role="status">
            {t("조회 중…", "Loading…")}
          </p>
        ) : (
          <>
            <UIDConfirmation
              events={detail}
              uid={selected}
              source={recent ? "recent" : "history"}
              ko={ko}
            />
            {detail.next && (
              <button
                className="secondary-button"
                onClick={() => void lookup(selected, detail.next!)}
              >
                {t("다음 페이지", "Next page")}
              </button>
            )}
          </>
        )}
      </section>
    );
  return (
    <>
      {recent && <CatalogNavigation current={catalog} ko={ko} eventSource />}
      {catalogUnavailable && (
        <section className="catalog-unavailable">
          <h2>
            {t(
              "이 구간은 Dojang 분류 미제공",
              "Dojang classification unavailable for this range",
            )}
          </h2>
          <p>
            {t(
              "발급 내역은 ‘분류 미확인’에 표시됩니다. 기록 부재를 뜻하지 않습니다.",
              "Issuances appear under ‘Unclassified’. This does not mean no records exist.",
            )}
          </p>
          <a href="?view=explore&source=backend&catalog=dojang">
            {t(
              "이전에 분류된 Dojang 기록 보기",
              "View previously classified Dojang records",
            )}
          </a>
        </section>
      )}
      {!catalogUnavailable && (
        <>
          <form
            className="event-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchError("");
              const value = search.trim();
              if (/^https?:/i.test(value) || value.startsWith("?")) {
                const target = resolveProductLookup(value, "record", "recent");
                if (target) {
                  location.href = target.href;
                  return;
                }
                setSearchError(
                  t(
                    "Dojangscan 공유 링크를 확인하세요.",
                    "Check the Dojangscan share link.",
                  ),
                );
                return;
              }
              const query = eventQuery(value, role, draft);
              if (query.kind === "invalid") {
                setSearchError(
                  t("UID 또는 주소를 입력하세요.", "Enter a UID or address."),
                );
                return;
              }
              if (query.kind === "uid") {
                void lookup(query.uid);
                return;
              }
              setDraft(query.filters);
              void load(query.filters);
            }}
          >
            <div className="event-search-primary">
              <label>
                {t("UID·주소·공유 링크", "UID, address or share link")}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="0x…"
                />
              </label>
              {isIssuerAddress(search.trim()) && (
                <label>
                  {t("주소 역할", "Address role")}
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                  >
                    <option value="recipient">
                      {t("수신 내역", "Received records")}
                    </option>
                    <option value="issuer">{t("발급 내역", "Issued records")}</option>
                  </select>
                </label>
              )}
              {technical && (
                <label>
                  {t("이벤트 종류", "Event type")}
                  <select
                    value={draft.event ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, event: e.target.value })
                    }
                  >
                    <option value="">{t("전체", "All")}</option>
                    {["Attested", "Revoked", "AttestationIndexed"].map((x) => (
                      <option key={x} value={x}>
                        {label(x)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" disabled={busy}>
                {t("조회", "Search")}
              </button>
            </div>
            <details className="event-advanced">
              <summary>
                {t("추가 필터", "More filters")}
                {[draft.schema, draft.issuer, draft.recipient].filter(Boolean)
                  .length > 0 &&
                  ` (${[draft.schema, draft.issuer, draft.recipient].filter(Boolean).length})`}
              </summary>
              <div className="event-advanced-fields">
                {(["schema", "issuer", "recipient"] as const).map((k) => (
                  <label key={k}>
                    {k === "schema"
                      ? t("스키마 UID", "Schema UID")
                      : k === "issuer"
                        ? t("발행자", "Issuer")
                        : t("수신자", "Recipient")}
                    <input
                      value={draft[k] ?? ""}
                      placeholder="0x…"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [k]: e.target.value.trim().toLowerCase(),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSearch("");
                  void load(draft);
                }}
              >
                {t("추가 필터 적용", "Apply additional filters")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSearch("");
                  setDraft({});
                  void load({});
                }}
              >
                {t("초기화", "Reset")}
              </button>
            </details>
          </form>
          <div className="activity-toolbar">
            <span className="result-scope">
              {technical
                ? t("수집된 이벤트", "Collected events")
                : t(
                    "발급 내역 · Dojang 분류 미확인",
                    "Issuances · Dojang classification unconfirmed",
                  )}
            </span>
            <button
              className="activity-refresh"
              disabled={busy}
              onClick={() => void load(filters, pageCursor)}
            >
              <RefreshCw size={16} />
              {t("새로고침", "Refresh")}
            </button>
          </div>
          <p className="activity-observation">
            {coverage ? (
              <>
                {t("관측", "Observed")}{" "}
                {displayDate(
                  coverage.meta.window?.tailing?.observedAt ??
                    coverage.meta.observedAt,
                  ko,
                )}{" "}
                · {t("부분 이력", "Partial history")} ·{" "}
                {t("화면 조회", "Retrieved")}{" "}
                {displayDate(viewedAt ?? null, ko)}
              </>
            ) : (
              t(
                "저장된 이벤트 조회 · 부분 이력",
                "Stored events · partial history",
              )
            )}
          </p>
          {searchError && (
            <p className="notice danger" role="alert">
              {searchError}
            </p>
          )}
          {error && (
            <p className="notice danger" role="alert">
              {error}
            </p>
          )}
          {busy && <LoadingRecords ko={ko} />}
          {page && (
            <>
              {empty(page)}
              {events(page)}
              {(page.next || pageCursor) && (
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
              )}
            </>
          )}
          <footer className="activity-footnote">
            <button onClick={() => setEvidenceOpen(true)}>
              {t("수집 범위·검증 근거", "Coverage & evidence")}
            </button>
          </footer>
        </>
      )}
      <Sheet
        open={evidenceOpen || !!selectedEvent}
        onOpenChange={(open) => {
          if (!open) {
            setEvidenceOpen(false);
            setSelectedEvent(undefined);
          }
        }}
      >
        <SheetContent className="backend-detail activity-detail">
          <SheetHeader>
            <SheetTitle>
              {selectedEvent
                ? activityTitle(selectedEvent, ko)
                : t("조회 근거", "Query evidence")}
            </SheetTitle>
            <SheetDescription>
              {t(
                "조회 결과와 검증 한계",
                "Results and verification limits",
              )}
            </SheetDescription>
          </SheetHeader>
          {selectedEvent ? (
            <ActivityEvidence
              events={[selectedEvent]}
              ko={ko}
              onUID={(uid) => {
                setSelectedEvent(undefined);
                void lookup(uid);
              }}
            />
          ) : (
            <section className="activity-evidence">
              <SourceContext source={recent ? "recent" : "history"} />
              <h3>
                {t("수집·검증 범위", "Collection and verification scope")}
              </h3>
              <p>
                {t(
                  "마지막 저장 시점 기준입니다. 서버 가동 상태를 보장하지 않으며 새로고침 시 갱신됩니다.",
                  "As of the last stored observation. This does not confirm server health; refresh to update.",
                )}
              </p>
              <p>
                {t(
                  "발견 범위와 Receipt 검증 범위는 다릅니다. 과거 이벤트나 Payload 해석으로 현재 자격을 판단하지 않습니다.",
                  "Discovery and receipt-verified coverage differ. Past events and interpreted payloads do not establish current eligibility.",
                )}
              </p>
              {coverage ? (
                <SourceJSON value={coverage} name="coverage.json" ko={ko} />
              ) : (
                <p>
                  {t("수집 범위 응답 미확인", "Coverage response unavailable")}
                </p>
              )}
            </section>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
