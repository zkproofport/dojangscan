import { recordKind, historyLabel } from "@/lib/record-presentation";
import { catalogURL, type CatalogView } from "@/lib/record-catalog";
import { short } from "@/lib/giwa";
import { addressURL, type RecordSource } from "@/lib/record-navigation";
import type { issuanceReferences } from "@/lib/record-catalog";
export function CatalogNavigation({
  current,
  ko,
  eventSource = false,
}: {
  current: CatalogView;
  ko: boolean;
  eventSource?: boolean;
}) {
  const views: CatalogView[] = eventSource
    ? ["dojang", "unconfirmed", "events"]
    : ["dojang", "unconfirmed", "eas"];
  const labels = {
    dojang: ko ? "Dojang 기록" : "Dojang records",
    unconfirmed: ko ? "분류 미확인" : "Unclassified",
    eas: ko ? "Dojang 외 기록" : "Non-Dojang records",
    events: ko ? "전체 이벤트" : "All events",
  };
  return (
    <nav
      className="catalog-navigation"
      aria-label={ko ? "기록 구분" : "Record category"}
    >
      {views.map((v) => (
        <a
          key={v}
          href={catalogURL(
            v,
            typeof location === "undefined" ? "" : location.search,
          )}
          aria-current={v === current ? "page" : undefined}
        >
          {labels[v]}
        </a>
      ))}
    </nav>
  );
}
export function IssuanceList({
  records,
  ko,
  source,
  onOpen,
}: {
  records: ReturnType<typeof issuanceReferences>;
  ko: boolean;
  source: RecordSource;
  onOpen: (uid: string) => void;
}) {
  return (
    <ul className="issuance-list">
      {records.map(({ event: e, network }) => {
        return (
          <li key={`${network}:${e.id}`}>
            <div className="issuance-name">
              <button onClick={() => onOpen(e.uid!)}>
                {recordKind(e.schema, e.uid!, ko)}
              </button>
              <span className="record-reference" title={e.uid!}>
                UID {short(e.uid!, 4)}
              </span>
            </div>
            <div className="issuance-parties">
              {(["issuer", "recipient"] as const).map((role) => (
                <span key={role}>
                  <small>
                    {ko
                      ? role === "issuer"
                        ? "발행자"
                        : "수신자"
                      : role === "issuer"
                        ? "Issuer"
                        : "Recipient"}
                  </small>
                  {e[role] ? (
                    <a
                      href={addressURL(e[role]!, role, source)}
                      title={e[role]!}
                    >
                      {/^0x0{40}$/i.test(e[role]!)
                        ? ko
                          ? "개별 수신자 없음"
                          : "No individual recipient"
                        : short(e[role]!, 4)}
                    </a>
                  ) : (
                    <span>{ko ? "미확인" : "Unknown"}</span>
                  )}
                </span>
              ))}
            </div>
            <button className="record-open" onClick={() => onOpen(e.uid!)}>
              {ko ? "상세 보기" : "View record"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function RecordHistory({
  events,
  ko,
  onSelect,
}: {
  events: import("@/lib/historical-api").HistoricalEvent[];
  ko: boolean;
  onSelect: () => void;
}) {
  return (
    <ol className="record-history">
      {events.map((e) => (
        <li key={e.id}>
          <span>{historyLabel(e.event, ko)}</span>
          <button
            onClick={onSelect}
            aria-label={`${historyLabel(e.event, ko)} · ${e.blockNumber}:${e.logIndex}`}
          >
            {ko ? "근거 확인" : "View evidence"}
          </button>
        </li>
      ))}
    </ol>
  );
}
