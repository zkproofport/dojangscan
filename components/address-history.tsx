import { useEffect, useRef, useState } from "react";
import type { Attestation, ScanData } from "@/lib/giwa";
import type { HistoryRole } from "@/lib/history";
import { tr } from "@/lib/i18n";
import { getData, ScanCards, CopyButton } from "./scan-ui";
import { ChainLoading } from "./chain-loading";

// Parent keys this component by address/role (and refreshed initial data).
export function AddressHistory({
  address,
  role,
  initial,
  onSelect,
  onIssuer,
  onRefresh,
}: {
  address: string;
  role: HistoryRole;
  initial?: ScanData;
  onSelect: (record: Attestation) => void;
  onIssuer: (address: string) => void;
  onRefresh?: () => void;
}) {
  const [data, setData] = useState<ScanData | null>(initial ?? null);
  const [busy, setBusy] = useState(!initial);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const request = useRef(0);
  const pending = useRef(false);
  const lastMore = useRef(false);
  async function load(more = false) {
    if (pending.current) return;
    pending.current = true;
    lastMore.current = more;
    const seq = ++request.current;
    setBusy(true);
    setError("");
    try {
      const result = await getData<ScanData>("history", {
        address,
        role,
        ...(more && data?.next ? { cursor: JSON.stringify(data.next) } : {}),
      });
      if (seq !== request.current) return;
      setData((old) => ({
        ...result,
        attestations:
          more && old
            ? [...old.attestations, ...result.attestations].filter(
                (a, i, all) => all.findIndex((b) => b.uid === a.uid) === i,
              )
            : result.attestations,
      }));
      if (!more) setPage(1);
    } catch (e) {
      if (seq === request.current) setError((e as Error).message);
    } finally {
      if (seq === request.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (!initial) void load();
    return () => {
      request.current++;
      pending.current = false;
    };
  }, [address, role]);
  const pages = Math.max(1, Math.ceil((data?.attestations.length ?? 0) / 6));
  const current = Math.min(page, pages);
  const issuer = data?.issuers.find(
    (i) => i.address.toLowerCase() === address.toLowerCase(),
  );
  return (
    <section
      className="address-history"
      aria-label={tr(role === "issuer" ? "발행한 도장" : "받은 도장")}
    >
      {role === "issuer" && (
        <div className="wallet-summary">
          <h2>{tr(issuer?.name ?? "발행 주소")}</h2>
          <div className="wallet-summary-address">
            <code>{address}</code>
            <CopyButton value={address} />
          </div>
          <p>
            {tr(
              "이 주소가 발행한 EAS 기록입니다. 현재 등록에서 제외된 발행자의 기록도 조회합니다.",
            )}
          </p>
        </div>
      )}
      {busy && (
        <ChainLoading
          title={
            lastMore.current
              ? "이전 기록을 불러오고 있습니다."
              : "발행 이력을 불러오고 있습니다."
          }
        />
      )}
      {error && (
        <div className="notice danger" role="alert">
          <p>{tr(error)}</p>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void load(lastMore.current)}
          >
            {tr("다시 조회")}
          </button>
        </div>
      )}
      {data && (
        <>
          <div className="section-heading">
            <p className="secondary">
              {tr("불러온 기록 {0}개", [data.attestations.length])}
            </p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => (onRefresh ? onRefresh() : void load())}
            >
              {tr("새로고침")}
            </button>
          </div>
          {data.attestations.length ? (
            <ScanCards
              items={data.attestations.slice((current - 1) * 6, current * 6)}
              onSelect={onSelect}
              onIssuer={onIssuer}
            />
          ) : (
            <p className="empty-state">
              {tr(
                data.next
                  ? "이번 조회 범위에는 일치하는 발급 기록이 없습니다. 이전 기록을 계속 조회할 수 있습니다."
                  : "탐색기가 제공하는 이력에서 발급 기록을 찾지 못했습니다.",
              )}
            </p>
          )}
          {pages > 1 && (
            <div className="record-pagination">
              <button
                disabled={current === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {tr("이전")}
              </button>
              <span>
                {current} / {pages}
              </span>
              <button
                disabled={current === pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tr("다음")}
              </button>
            </div>
          )}
          {data.next ? (
            <div className="load-more">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void load(true)}
              >
                {tr(busy ? "조회 중" : "이전 기록 더 보기")}
              </button>
            </div>
          ) : (
            <p className="fine-print" role="status">
              {tr("탐색기가 제공하는 이력을 끝까지 조회했습니다.")}
            </p>
          )}
          <p className="fine-print">
            {tr(data.coverage)}{" "}
            {tr("새 기록은 탐색기에 반영되기까지 시간이 걸릴 수 있습니다.")}
          </p>
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
    </section>
  );
}
