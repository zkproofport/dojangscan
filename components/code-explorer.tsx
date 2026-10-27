import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { codeHistory } from "@/lib/scan-data";
import {
  codeCSV,
  codeField,
  codeParams,
  matchesUseCase,
  emptyCodeFilters,
  filterCodeRecords,
  readCodeFilters,
  verifyCode,
  prepareCodeVerification,
  type CodeFilters,
} from "@/lib/code-records";
import { localURL, shareURL } from "@/lib/navigation";
import { short, type Attestation } from "@/lib/giwa";
import { tr } from "@/lib/i18n";
import { ChainLoading } from "./chain-loading";
import { Status, CopyButton, getData } from "./scan-ui";

type Page = Awaited<ReturnType<typeof codeHistory>>;
const date = (time: number) =>
  time
    ? new Date(time * 1000).toISOString().replace("T", " ").slice(0, 19)
    : tr("기한 없음");
export default function CodeExplorer({
  onSelect,
  onIssuer,
  searchRequested = false,
}: {
  onSelect: (record: Attestation) => void;
  onIssuer: (address: string) => void;
  searchRequested?: boolean;
}) {
  const [filters, setFilters] = useState(() =>
    readCodeFilters(new URLSearchParams(window.location.search)),
  );
  const [searchInput, setSearchInput] = useState(
    filters.query || filters.domain,
  );
  const [data, setData] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [showVerification, setShowVerification] = useState(false);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const pending = useRef(false),
    revision = useRef(0),
    lastMore = useRef(false);
  async function load(more = false) {
    if (pending.current) return;
    pending.current = true;
    lastMore.current = more;
    const current = ++revision.current;
    setBusy(true);
    setError("");
    if (!more) {
      setData(null);
      setPage(1);
      setOriginalCode("");
      resetVerification();
    }
    try {
      const result = await codeHistory(
        more ? data?.next : null,
        more ? data?.block : undefined,
      );
      if (current !== revision.current) return;
      setData((old) => ({
        ...result,
        attestations:
          more && old
            ? [...old.attestations, ...result.attestations].filter(
                (a, i, all) => all.findIndex((b) => b.uid === a.uid) === i,
              )
            : result.attestations,
      }));
    } catch (e) {
      if (current === revision.current) setError((e as Error).message);
    } finally {
      if (current === revision.current) {
        setBusy(false);
        pending.current = false;
      }
    }
  }
  useEffect(() => {
    // A main-search submission is an explicit request; opening a menu or URL is not.
    if (searchRequested) void load();
    return () => {
      revision.current++;
      pending.current = false;
      verifyRevision.current++;
    };
  }, []);
  function change(next: CodeFilters) {
    setFilters(next);
    setPage(1);
    window.history.replaceState(null, "", localURL(codeParams(next)));
  }
  function submitSearch() {
    if (pending.current || !searchInput.trim()) return;
    const next =
      filters.domain && searchInput === filters.domain
        ? { ...filters, query: "" }
        : { ...filters, domain: "", query: searchInput.trim() };
    change(next);
    setSearchInput(next.query || next.domain);
    setShowAllDomains(false);
    resetVerification();
    setShowVerification(false);
    setOriginalCode("");
    void load();
  }
  function selectDomain(domain: string) {
    setSearchInput(domain);
    change({ ...filters, domain, query: "" });
  }
  let items: Attestation[] = [],
    filterError = "";
  try {
    items = filterCodeRecords(data?.attestations ?? [], filters);
  } catch (e) {
    filterError = (e as Error).message;
  }
  const domains = [
    ...new Set(data?.attestations.map((a) => codeField(a, "domain")) ?? []),
  ]
    .filter(Boolean)
    .sort();
  const matchingDomains = domains.filter((d) =>
    matchesUseCase(d, filters.query),
  );
  const suggestedDomains = matchingDomains.length ? matchingDomains : domains;
  const extraFilters = !!(
    filters.issuer ||
    filters.status !== "all" ||
    filters.from ||
    filters.to
  );
  const issuers = [
    ...new Set([
      ...(data?.attestations.map((a) => a.attester) ?? []),
      ...(filters.issuer ? [filters.issuer] : []),
    ]),
  ];
  const pages = Math.max(1, Math.ceil(items.length / 25)),
    currentPage = Math.min(page, pages);
  const [verifyDomain, setVerifyDomain] = useState(filters.domain);
  const [codeHash, setCodeHash] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [inputKind, setInputKind] = useState<"code" | "hash">("code");
  const [selectedRecordUID, setSelectedRecordUID] = useState("");
  const [issuerId, setIssuerId] = useState("");
  const [verification, setVerification] = useState<Awaited<
    ReturnType<typeof verifyCode>
  > | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false),
    [verifyError, setVerifyError] = useState("");
  const verifyRevision = useRef(0);
  const selectedIssuer = data?.issuers.find((i) => i.id === issuerId);
  function resetVerification() {
    verifyRevision.current++;
    setVerification(null);
    setVerifyError("");
    setVerifyBusy(false);
  }
  async function checkCode() {
    if (!selectedIssuer) return;
    const seq = ++verifyRevision.current;
    setVerification(null);
    setVerifyError("");
    setVerifyBusy(true);
    try {
      const prepared = prepareCodeVerification(
        inputKind === "code" ? originalCode : codeHash,
        verifyDomain,
        inputKind,
      );
      const result = await verifyCode({
        ...prepared,
        attesterId: issuerId,
        expectedIssuer: selectedIssuer.address,
      });
      if (seq === verifyRevision.current) setVerification(result);
    } catch (e) {
      if (seq === verifyRevision.current) setVerifyError((e as Error).message);
    } finally {
      if (seq === verifyRevision.current) setVerifyBusy(false);
    }
  }
  function selectCode(record: Attestation) {
    resetVerification();
    setShowVerification(true);
    setInputKind("hash");
    setOriginalCode("");
    setSelectedRecordUID(record.uid);
    setVerifyDomain(codeField(record, "domain"));
    setCodeHash(codeField(record, "codeHash"));
    setIssuerId(
      data?.issuers.find(
        (i) => i.address.toLowerCase() === record.attester.toLowerCase(),
      )?.id ?? "",
    );
    requestAnimationFrame(() =>
      document
        .getElementById("code-verification")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function openReceivedCode() {
    resetVerification();
    setInputKind("code");
    setOriginalCode("");
    setCodeHash("");
    setSelectedRecordUID("");
    const domain =
      filters.domain ||
      (matchingDomains.length === 1 ? matchingDomains[0] : "");
    setVerifyDomain(domain);
    const addresses = [
      ...new Set(
        items
          .filter((a) => codeField(a, "domain") === domain)
          .map((a) => a.attester.toLowerCase()),
      ),
    ];
    setIssuerId(
      addresses.length === 1
        ? (data?.issuers.find((i) => i.address.toLowerCase() === addresses[0])
            ?.id ?? "")
        : "",
    );
    setShowVerification(true);
    requestAnimationFrame(() =>
      document
        .getElementById("code-verification")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([codeCSV(items, { ...data, complete: !data.next })], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dojang-code-records.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="code-explorer view-section">
      <div className="studio-panel">
        <div className="section-heading">
          <h2>{tr("사용처 찾기")}</h2>
          {data && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                resetVerification();
                void load();
              }}
            >
              {tr("새로고침")}
            </button>
          )}
        </div>
        <form
          className="usecase-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <label className="usecase-search">
            {tr("인증 코드 사용처")}
            <input
              className="form-input"
              type="search"
              placeholder="doctorloan"
              maxLength={512}
              required
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={busy || !searchInput.trim()}
          >
            {tr(busy ? "조회 중" : "찾기")}
          </button>
        </form>
        {!data && !busy && !error && (
          <p className="fine-print">
            {tr(
              "사용처를 입력하고 찾기 또는 Enter를 누르면 발급 내역을 조회합니다.",
            )}
          </p>
        )}
        {!!domains.length && (
          <div className="usecase-discovery">
            <p className="fine-print">
              {tr(
                filters.query && !matchingDomains.length
                  ? "불러온 기록에는 일치하는 사용처가 없습니다. 아래 사용처를 선택해 보세요."
                  : "불러온 기록의 사용처",
              )}
            </p>
            <div className="usecase-options">
              <button
                className="secondary-button"
                aria-pressed={!filters.domain && !filters.query}
                onClick={() => selectDomain("")}
              >
                {tr("전체")}
              </button>
              {(showAllDomains
                ? suggestedDomains
                : suggestedDomains.slice(0, 8)
              ).map((domain) => (
                <button
                  key={domain}
                  className="secondary-button"
                  aria-pressed={filters.domain === domain}
                  onClick={() => selectDomain(domain)}
                >
                  {domain}
                </button>
              ))}
              {suggestedDomains.length > 8 && (
                <button
                  className="text-button"
                  onClick={() => setShowAllDomains(!showAllDomains)}
                >
                  {tr(showAllDomains ? "접기" : "사용처 더 보기")}
                </button>
              )}
            </div>
          </div>
        )}
        {data && (
          <>
            <details
              className="data-notes code-extra-filters"
              open={extraFilters || undefined}
            >
              <summary>
                {tr("상세 조건")}
                {extraFilters && ` · ${tr("적용 중")}`}
              </summary>
              <div className="code-filters">
                <label>
                  {tr("발행자")}
                  <select
                    className="form-input"
                    value={filters.issuer}
                    onChange={(e) =>
                      change({ ...filters, issuer: e.target.value })
                    }
                  >
                    <option value="">{tr("전체")}</option>
                    {issuers.map((a) => (
                      <option key={a} value={a}>
                        {short(a, 10)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr("상태")}
                  <select
                    className="form-input"
                    value={filters.status}
                    onChange={(e) =>
                      change({ ...filters, status: e.target.value })
                    }
                  >
                    <option value="all">{tr("전체")}</option>
                    <option value="active">{tr("활성")}</option>
                    <option value="expired">{tr("만료")}</option>
                    <option value="revoked">{tr("취소")}</option>
                  </select>
                </label>
                <label>
                  {tr("발급 시작일 (UTC)")}
                  <input
                    className="form-input"
                    type="date"
                    value={filters.from}
                    onChange={(e) =>
                      change({ ...filters, from: e.target.value })
                    }
                  />
                </label>
                <label>
                  {tr("발급 종료일 (UTC)")}
                  <input
                    className="form-input"
                    type="date"
                    value={filters.to}
                    onChange={(e) => change({ ...filters, to: e.target.value })}
                  />
                </label>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  change({
                    ...emptyCodeFilters,
                    domain: filters.domain,
                    query: filters.query,
                  })
                }
              >
                {tr("상세 조건 초기화")}
              </button>
            </details>
            <div className="example-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(shareURL(codeParams(filters)))
                    .then(() => toast.success(tr("조회 링크를 복사했습니다.")))
                    .catch(() => toast.error(tr("링크를 복사하지 못했습니다.")))
                }
              >
                {tr("조회 링크 복사")}
              </button>
              <button
                className="secondary-button"
                disabled={!items.length || !!filterError}
                onClick={download}
              >
                {tr("조회 결과 CSV 저장")}
              </button>
            </div>
          </>
        )}
        {busy && (
          <ChainLoading
            title="코드 인증 기록을 불러오고 있습니다."
            description="코드 인증 이벤트를 조회하고 온체인 상태를 확인합니다."
          />
        )}
        {error && (
          <div className="notice danger" role="alert">
            <span>{tr(error)}</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void load(lastMore.current)}
            >
              {tr("다시 조회")}
            </button>
          </div>
        )}
        {filterError && (
          <p className="notice danger" role="alert">
            {tr(filterError)}
          </p>
        )}
        {data && (
          <>
            <div className="code-results-heading">
              <div>
                <h2>{tr("인증 코드 발급 내역")}</h2>
                <p className="fine-print">
                  {tr(
                    "사용처가 같아도 코드 식별값이 다르면 다른 코드입니다. 한 코드가 여러 번 발급될 수 있어 각 발급 기록은 UID로 구분합니다.",
                  )}
                </p>
              </div>
              <button className="secondary-button" onClick={openReceivedCode}>
                {tr("전달받은 코드 확인")}
              </button>
            </div>
            <p className="code-coverage">
              {tr("조회한 사용처: {0}", [
                filters.domain || filters.query || tr("전체"),
              ])}
              <br />
              {tr("불러온 기록 {0}개 · 조건에 맞는 기록 {1}개", [
                data.attestations.length,
                items.length,
              ])}
            </p>
            <details className="data-notes">
              <summary>{tr("조회 범위와 기준 시점")}</summary>
              <p className="fine-print">
                {tr("조회 기준: 블록 {0} · {1}", [data.block, data.checkedAt])}
                <br />
                {tr(
                  data.next
                    ? "현재 코드 인증 스키마의 일부 이력입니다. 이전 기록을 더 불러올 수 있습니다."
                    : "현재 코드 인증 스키마에 대해 탐색기가 제공하는 이력을 끝까지 조회했습니다.",
                )}
              </p>
              <p className="fine-print">
                {tr(
                  "상태와 CSV는 조회 기준 시점의 결과입니다. 최신 발급·취소·만료를 확인하려면 새로고침하세요. 탐색기 반영이 지연될 수 있습니다.",
                )}
              </p>
              <p className="fine-print">
                {tr(
                  "사용처는 온체인에 기록된 이름입니다. 같은 사용처 이름을 여러 발행자가 쓸 수 있습니다.",
                )}
              </p>
            </details>
            {items.length ? (
              <div
                className="code-table-scroll"
                tabIndex={0}
                role="region"
                aria-label={tr("코드 인증 기록")}
              >
                <table className="code-table">
                  <thead>
                    <tr>
                      {[
                        "코드 · 발급 기록",
                        "사용처",
                        "발행자",
                        "발급 시각 (UTC)",
                        "만료 시각 (UTC)",
                        "기록 상태",
                        "조회",
                      ].map((h) => (
                        <th key={h}>{tr(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .slice((currentPage - 1) * 25, currentPage * 25)
                      .map((a) => (
                        <tr key={a.uid}>
                          <td className="code-record-identity">
                            <div>
                              <code title={codeField(a, "codeHash")}>
                                {short(codeField(a, "codeHash"), 8)}
                              </code>
                              <CopyButton
                                value={codeField(a, "codeHash")}
                                label="코드 식별값 복사"
                              />
                            </div>
                            <button
                              className="text-button"
                              title={a.uid}
                              onClick={() => onSelect(a)}
                            >
                              UID {short(a.uid, 6)}
                            </button>
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => {
                                setSearchInput(codeField(a, "domain"));
                                change({
                                  ...filters,
                                  query: "",
                                  domain: codeField(a, "domain"),
                                  issuer: a.attester,
                                });
                              }}
                            >
                              {codeField(a, "domain")}
                            </button>
                          </td>
                          <td>
                            <button
                              className="text-button"
                              title={a.attester}
                              onClick={() => onIssuer(a.attester)}
                            >
                              {short(a.attester, 8)}
                            </button>
                          </td>
                          <td>{date(a.time)}</td>
                          <td>{date(a.expirationTime)}</td>
                          <td>
                            <Status value={a.status} />
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => onSelect(a)}
                            >
                              {tr("상세 보기")}
                            </button>
                            <button
                              className="text-button"
                              onClick={() => selectCode(a)}
                            >
                              {tr("현재 유효성 확인")}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                {tr(
                  data.next
                    ? "불러온 범위에는 조건에 맞는 기록이 없습니다. 이전 기록을 더 조회하세요."
                    : "조회한 이력에는 조건에 맞는 기록이 없습니다.",
                )}
              </p>
            )}
            {pages > 1 && (
              <div className="record-pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {tr("이전")}
                </button>
                <span>
                  {currentPage} / {pages}
                </span>
                <button
                  disabled={currentPage === pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {tr("다음")}
                </button>
              </div>
            )}
            {data.next && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void load(true)}
              >
                {tr("이전 코드 인증 기록 더 보기")}
              </button>
            )}
            {!!data.warnings.length && (
              <details className="data-notes">
                <summary>{tr("조회 범위 안내")}</summary>
                {data.warnings.map((w) => (
                  <p key={w}>{tr(w)}</p>
                ))}
              </details>
            )}
          </>
        )}
      </div>
      {data && (
        <details
          className="studio-panel code-verifier"
          id="code-verification"
          open={showVerification}
          onToggle={(e) => {
            setShowVerification(e.currentTarget.open);
            if (!e.currentTarget.open) {
              setOriginalCode("");
              resetVerification();
            }
          }}
        >
          <summary>{tr("인증 코드 유효성 확인")}</summary>
          <p>
            {tr(
              "발행자가 해당 사용처에 발급한 코드의 현재 유효성을 확인합니다. 지갑 연결 없이 조회하며 코드를 사용 처리하지 않습니다.",
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void checkCode();
            }}
          >
            <div
              className="code-input-mode"
              role="group"
              aria-label={tr("확인할 값")}
            >
              <button
                type="button"
                aria-pressed={inputKind === "code"}
                onClick={() => {
                  setInputKind("code");
                  setSelectedRecordUID("");
                  resetVerification();
                }}
              >
                {tr("전달받은 코드")}
              </button>
              <button
                type="button"
                aria-pressed={inputKind === "hash"}
                onClick={() => {
                  setInputKind("hash");
                  setOriginalCode("");
                  setSelectedRecordUID("");
                  resetVerification();
                }}
              >
                {tr("공개 코드 해시")}
              </button>
            </div>
            <div className="code-filters">
              <label>
                {tr("인증 코드 사용처")}
                <input
                  className="form-input"
                  required
                  value={verifyDomain}
                  onChange={(e) => {
                    setVerifyDomain(e.target.value);
                    setSelectedRecordUID("");
                    resetVerification();
                  }}
                />
              </label>
              <label>
                {tr("등록 발행자")}
                <select
                  className="form-input"
                  required
                  value={issuerId}
                  onChange={(e) => {
                    setIssuerId(e.target.value);
                    setSelectedRecordUID("");
                    resetVerification();
                  }}
                >
                  <option value="">{tr("등록 발행자를 선택하세요.")}</option>
                  {data?.issuers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {tr(i.name)} · {short(i.address, 8)} · {short(i.id, 4)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="code-hash-input">
                {tr(
                  inputKind === "code"
                    ? "전달받은 인증 코드"
                    : "코드 식별값 (해시)",
                )}
                <input
                  className="form-input"
                  required
                  type={inputKind === "code" ? "password" : "text"}
                  autoComplete={inputKind === "code" ? "one-time-code" : "off"}
                  autoCapitalize="none"
                  placeholder={
                    inputKind === "code"
                      ? tr("전달받은 코드를 그대로 입력하세요.")
                      : "0x… (bytes32)"
                  }
                  value={inputKind === "code" ? originalCode : codeHash}
                  onChange={(e) => {
                    if (inputKind === "code") setOriginalCode(e.target.value);
                    else setCodeHash(e.target.value);
                    setSelectedRecordUID("");
                    resetVerification();
                  }}
                  spellCheck={false}
                />
              </label>
            </div>
            {selectedIssuer && (
              <p className="fine-print break-code">
                {tr("발행자")}: {selectedIssuer.address}
              </p>
            )}
            <p className="fine-print">
              {tr(
                inputKind === "code"
                  ? "원본 코드는 브라우저에서 해시로 변환하고 해시만 조회에 사용합니다. 이 확인 도구의 입력값은 공유 링크나 CSV에 추가하지 않습니다."
                  : "공개된 코드 해시로 발급 기록을 확인합니다. 원본 코드를 알고 있거나 정당한 사용자라는 증명은 아닙니다.",
              )}
            </p>
            <button
              className="primary"
              disabled={
                verifyBusy ||
                !selectedIssuer ||
                !verifyDomain ||
                !(inputKind === "code" ? originalCode : codeHash)
              }
            >
              {tr(verifyBusy ? "조회 중" : "유효성 확인")}
            </button>
          </form>
          {verifyBusy && (
            <ChainLoading title="온체인 코드 인증 여부를 확인하고 있습니다." />
          )}
          {verifyError && (
            <p className="notice danger" role="alert">
              {tr(verifyError)}
            </p>
          )}
          {verification && (
            <div className="code-verification-result" role="status">
              <strong>
                {tr(
                  verification.valid
                    ? "현재 유효한 발급 기록을 찾았습니다."
                    : "이 조건의 유효한 발급 기록을 찾지 못했습니다.",
                )}
              </strong>
              <dl className="code-check-context">
                <div>
                  <dt>{tr("사용처")}</dt>
                  <dd>{verification.domain}</dd>
                </div>
                <div>
                  <dt>{tr("발행자")}</dt>
                  <dd>
                    <code>{verification.expectedIssuer}</code>
                  </dd>
                </div>
                <div>
                  <dt>{tr("코드 식별값 (해시)")}</dt>
                  <dd>
                    <code>{verification.codeHash}</code>
                  </dd>
                </div>
              </dl>
              {verification.uid &&
                selectedRecordUID &&
                verification.uid.toLowerCase() !==
                  selectedRecordUID.toLowerCase() && (
                  <p>
                    {tr(
                      "현재 조회되는 발급 기록은 선택한 기록과 UID가 다릅니다. 아래 상세에서 확인하세요.",
                    )}
                  </p>
                )}
              <p>
                {tr("조회 기준: 블록 {0} · {1}", [
                  verification.block,
                  verification.checkedAt,
                ])}
              </p>
              <p>
                {tr(
                  "이 결과는 발급 기록의 유효성만 확인합니다. 제출자의 신원·이용 자격·코드 사용 완료나 외부 서비스의 처리 결과를 증명하지 않습니다.",
                )}
              </p>
              {!verification.valid && (
                <p>
                  {tr(
                    "입력값 불일치, 기록 없음, 만료 또는 취소 등이 원인일 수 있습니다.",
                  )}
                </p>
              )}
              {verification.uid && (
                <button
                  className="text-button"
                  onClick={() => {
                    const seq = verifyRevision.current;
                    void getData<Attestation>("attestation", {
                      uid: verification.uid!,
                    })
                      .then((record) => {
                        if (seq === verifyRevision.current) onSelect(record);
                      })
                      .catch((e) => {
                        if (seq === verifyRevision.current)
                          setVerifyError(e.message);
                      });
                  }}
                >
                  {tr("현재 발급 기록 상세 보기")} ·{" "}
                  {short(verification.uid, 8)}
                </button>
              )}
            </div>
          )}
        </details>
      )}
    </section>
  );
}
