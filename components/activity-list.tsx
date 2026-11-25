import { SourceJSON } from "./source-json";
import type { HistoricalEvent } from "@/lib/historical-api";
import { SCHEMAS, short, NETWORK } from "@/lib/giwa";
import { addressURL, type RecordSource } from "@/lib/record-navigation";

export function activityTitle(event: HistoricalEvent, ko: boolean) {
  const known = SCHEMAS.find(
    (s) => s.uid.toLowerCase() === event.schema?.toLowerCase(),
  );
  if (known) return ko ? known.label : known.name;
  return (
    {
      Attested: ko ? "EAS 발급" : "Attestation issued",
      Revoked: ko ? "EAS 철회" : "Attestation revoked",
      AttestationIndexed: ko ? "Indexer 변경" : "Indexer changed",
    }[event.event] ?? (ko ? "계약 이벤트" : "Contract event")
  );
}
export function ActivityList({
  events,
  ko,
  source,
  onSelect,
  onEvidence,
}: {
  events: HistoricalEvent[];
  ko: boolean;
  source: RecordSource;
  onSelect: (event: HistoricalEvent) => void;
  onEvidence?: (event: HistoricalEvent) => void;
}) {
  const relation = (address: string | null, role: "issuer" | "recipient") =>
    address ? (
      <a
        href={addressURL(address, role, source)}
        title={address}
        aria-label={`${ko ? (role === "issuer" ? "발급 기록" : "수신 기록") : role === "issuer" ? "Issued records" : "Received records"}: ${address}`}
      >
        {/^0x0{40}$/i.test(address)
          ? ko
            ? "개별 수신자 없음"
            : "No individual recipient"
          : short(address, 4)}
      </a>
    ) : (
      <span>{ko ? "미확인" : "Unknown"}</span>
    );
  return (
    <ol
      className="activity-list"
      aria-label={ko ? "이벤트 목록" : "Event list"}
    >
      {events.map((e) => (
        <li className="activity-row" key={e.id}>
          <span className={`activity-kind kind-${e.event}`}>
            {{
              Attested: ko ? "발급" : "Issued",
              Revoked: ko ? "철회" : "Revoked",
              AttestationIndexed: ko ? "Indexer 변경" : "Indexer change",
            }[e.event] ?? e.event}
          </span>
          <div className="activity-subject">
            <button onClick={() => onSelect(e)}>{activityTitle(e, ko)}</button>
            <span>
              {e.uid
                ? `UID ${short(e.uid, 4)}`
                : ko
                  ? "UID 없는 계약 기록"
                  : "Contract record without UID"}
              {!SCHEMAS.some(
                (s) => s.uid.toLowerCase() === e.schema?.toLowerCase(),
              ) && <span> · {ko ? "종류 미확인" : "Type unknown"}</span>}
            </span>
          </div>
          <div className="activity-relationship">
            {relation(e.issuer, "issuer")}
            <span aria-label={ko ? "수신자" : "recipient"}>→</span>
            {relation(e.recipient, "recipient")}
          </div>
          <div className="activity-reference">
            <span
              className="activity-proof"
              title={
                e.receiptVerified
                  ? ko
                    ? "이벤트 블록의 Receipt 검증 근거 있음"
                    : "Receipt evidence for the event block"
                  : ko
                    ? "로그 발견만 확인 · Receipt 미검증"
                    : "Log discovery only · receipt unverified"
              }
            >
              {e.receiptVerified ? "Receipt" : ko ? "로그" : "Log"}
            </span>
            <span>#{e.blockNumber.toLocaleString()}</span>
          </div>
          <button
            className="activity-open"
            onClick={() => (onEvidence ?? onSelect)(e)}
            aria-label={`${ko ? "이벤트 상세" : "Event details"}: ${e.event} ${e.blockNumber}:${e.logIndex}`}
          >
            {ko ? "근거" : "Evidence"}
          </button>
        </li>
      ))}
    </ol>
  );
}
/** One evidence area, retaining every event separately and in response order. */
export function ActivityEvidence({
  events,
  ko,
  onUID,
}: {
  events: HistoricalEvent[];
  ko: boolean;
  onUID?: (uid: string) => void;
}) {
  return (
    <section className="activity-evidence">
      <h3>{ko ? "이벤트 원본과 거래" : "Event sources and transactions"}</h3>
      <p>
        {ko
          ? "로그는 발견된 이벤트, Receipt는 해당 블록의 거래 증거 검증을 뜻합니다. 내용의 사실성이나 현재 이용 자격을 증명하지 않습니다."
          : "Log means event discovery; Receipt means verified transaction evidence for that block. Neither proves content truth or current eligibility."}
      </p>
      {events.map((e) => (
        <section key={e.id}>
          <h4>
            {activityTitle(e, ko)} · #{e.blockNumber.toLocaleString()} /{" "}
            {e.logIndex}
          </h4>
          <a
            href={`${NETWORK.explorer}/tx/${e.transactionHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {ko
              ? "GIWA Explorer에서 거래 확인"
              : "View transaction on GIWA Explorer"}
          </a>
          <p>
            {ko
              ? e.receiptVerified
                ? "거래 증거 대조 완료"
                : "이벤트만 발견 · 거래 증거 미검증"
              : e.receiptVerified
                ? "Transaction evidence checked"
                : "Event discovered · transaction evidence unchecked"}
          </p>
          {e.refUID && onUID && (
            <button onClick={() => onUID(e.refUID!)}>
              {ko ? "연결된 UID 조회" : "Referenced UID"}
            </button>
          )}
        </section>
      ))}
      <SourceJSON value={events} name="events.json" ko={ko} />
    </section>
  );
}
