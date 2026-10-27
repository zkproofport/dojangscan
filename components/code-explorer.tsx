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
  type CodeFilters,
} from "@/lib/code-records";
import { localURL, shareURL } from "@/lib/navigation";
import { short, type Attestation } from "@/lib/giwa";
import { tr } from "@/lib/i18n";
import { ChainLoading } from "./chain-loading";
import { Status, getData } from "./scan-ui";

type Page = Awaited<ReturnType<typeof codeHistory>>;
const date = (time: number) =>
  time
    ? new Date(time * 1000).toISOString().replace("T", " ").slice(0, 19)
    : tr("기한 없음");
export default function CodeExplorer({
  onSelect,
  onIssuer,
}: {
  onSelect: (record: Attestation) => void;
  onIssuer: (address: string) => void;
}) {
  const [filters, setFilters] = useState(() =>
    readCodeFilters(new URLSearchParams(window.location.search)),
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
    void load();
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
      const result = await verifyCode({
        domain: verifyDomain,
        codeHash: codeHash.trim(),
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
        </div>
        <label className="usecase-search">
          {tr("인증 코드 사용처")}
          <input
            className="form-input"
            type="search"
            placeholder={tr("사용처 이름으로 검색")}
            maxLength={512}
            value={filters.query || filters.domain}
            onChange={(e) => {
              setShowAllDomains(false);
              change({ ...filters, domain: "", query: e.target.value });
            }}
          />
        </label>
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
                onClick={() => change({ ...filters, domain: "", query: "" })}
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
                  onClick={() => change({ ...filters, domain, query: "" })}
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
                onChange={(e) => change({ ...filters, issuer: e.target.value })}
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
                onChange={(e) => change({ ...filters, status: e.target.value })}
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
                onChange={(e) => change({ ...filters, from: e.target.value })}
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
            <p className="code-coverage">
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
                        "사용처",
                        "발행자",
                        "발급 시각 (UTC)",
                        "만료 시각 (UTC)",
                        "상태",
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
                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                change({
                                  ...filters,
                                  query: "",
                                  domain: codeField(a, "domain"),
                                  issuer: a.attester,
                                })
                              }
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
                              {tr("인증 확인")}
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
      <details
        className="studio-panel code-verifier"
        id="code-verification"
        open={showVerification}
        onToggle={(e) => setShowVerification(e.currentTarget.open)}
      >
        <summary>{tr("코드 해시로 유효성 확인")}</summary>
        <p>
          {tr(
            "사용처·등록 발행자·코드 해시로 현재 온체인 인증 여부를 확인합니다. 지갑 연결이나 서명이 필요 없습니다.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void checkCode();
          }}
        >
          <div className="code-filters">
            <label>
              {tr("인증 코드 사용처")}
              <input
                className="form-input"
                required
                value={verifyDomain}
                onChange={(e) => {
                  setVerifyDomain(e.target.value);
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
              {tr("인증 코드 해시")}
              <input
                className="form-input"
                required
                placeholder="0x… (bytes32)"
                value={codeHash}
                onChange={(e) => {
                  setCodeHash(e.target.value);
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
              "원본 인증번호가 아닌 코드 해시를 입력하세요. 인증번호와 코드 해시는 공유 링크에 포함하지 않습니다.",
            )}
          </p>
          <button
            className="primary"
            disabled={
              verifyBusy || !selectedIssuer || !verifyDomain || !codeHash
            }
          >
            {tr(verifyBusy ? "조회 중" : "인증 확인")}
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
                  ? "온체인 코드 인증 유효"
                  : "현재 유효한 코드 인증을 확인하지 못했습니다.",
              )}
            </strong>
            <p>
              {tr("조회 기준: 블록 {0} · {1}", [
                verification.block,
                verification.checkedAt,
              ])}
            </p>
            <p>
              {tr(
                "이 결과는 온체인 인증 상태입니다. 외부 서비스의 처리 상태나 코드 사용 여부를 뜻하지 않습니다.",
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
                {tr("인증 도장 상세 보기")} · {short(verification.uid, 8)}
              </button>
            )}
          </div>
        )}
      </details>
    </section>
  );
}
