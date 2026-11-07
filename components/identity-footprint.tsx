import { useEffect, useId, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Fingerprint,
} from "lucide-react";
import {
  NETWORK,
  short,
  type Attestation,
  type Issuer,
  type ScanData,
} from "@/lib/giwa";
import {
  extractFootprint,
  loadFootprintActivity,
  type ActivityResult,
  type RelationshipKind,
} from "@/lib/identity-footprint";
import { tr } from "@/lib/i18n";
import { formatDateTime } from "@/lib/date-time";
import { ISSUER_LABELS } from "@/lib/trust";

const labels: Record<RelationshipKind, string> = {
  attestation: "EAS 주소 인증 기록",
  contract: "컨트랙트 호출",
  transfer: "직접 토큰 전송",
};
type Props = {
  data: ScanData & { address: string; verifiedBy: Issuer[] };
  onSelect: (a: Attestation) => void;
  onStudio: () => void;
};

// The parent keys by wallet + snapshot, so a new search starts collapsed.
export function IdentityFootprint({ data, onSelect, onStudio }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"direct" | "zk">("direct");
  const [activity, setActivity] = useState<ActivityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!open || activity) return;
    const controller = new AbortController();
    setBusy(true);
    void loadFootprintActivity(data.address, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setActivity(result);
          setBusy(false);
        }
      },
    );
    return () => controller.abort();
  }, [open, data.address, activity, attempt]);
  const { edges, limited } = extractFootprint(
    data.address,
    data.attestations,
    data.schemas,
    activity,
  );
  const edge = edges.find((item) => item.id === selected);
  const issueEntries = Object.entries(activity?.issues ?? {});
  const select = (key: string | null) => setSelected(key);
  const svgId = id.replace(/:/g, "");
  return (
    <section className="identity-footprint" aria-labelledby={`${id}-title`}>
      <button
        className="footprint-heading"
        aria-expanded={open}
        aria-controls={`${id}-content`}
        onClick={() => setOpen(!open)}
      >
        <Fingerprint size={24} aria-hidden="true" />
        <span>
          <strong id={`${id}-title`}>Identity Footprint</strong>
          <span>{tr("이 인증 지갑의 공개 활동은 어디까지 연결될까요?")}</span>
        </span>
        <ChevronDown
          size={18}
          className={open ? "footprint-chevron-open" : ""}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={`${id}-content`} className="footprint-content">
          <div className="footprint-toolbar">
            <div
              className="footprint-switch"
              role="group"
              aria-label={tr("인증 방식 비교")}
            >
              <button
                aria-pressed={mode === "direct"}
                onClick={() => setMode("direct")}
              >
                {tr("직접 인증")}
              </button>
              <button
                aria-pressed={mode === "zk"}
                onClick={() => setMode("zk")}
              >
                With ZKProofport
              </button>
            </div>
            <span className="fine-print">
              {mode === "direct"
                ? "GIWA Sepolia · 1 hop"
                : tr("아키텍처 예시 · 실제 지갑 기록 아님")}
            </span>
          </div>
          {mode === "direct" ? (
            <>
              <p className="footprint-intro">
                {tr(
                  "인증에 사용한 주소가 dApp과 직접 상호작용하면 공개 인증 상태와 활동을 같은 주소로 연결할 수 있습니다.",
                )}
              </p>
              <div className="footprint-legend">
                {Object.entries(labels).map(([kind, label]) => (
                  <span key={kind}>
                    <i className={`footprint-swatch ${kind}`} />
                    {tr(label)}
                  </span>
                ))}
              </div>
              <div className="footprint-layout">
                <div
                  className="footprint-graph"
                  aria-label={tr("지갑의 직접 연결 그래프")}
                >
                  <svg
                    viewBox="0 0 1000 360"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      {(["attestation", "contract", "transfer"] as const).map(
                        (kind) => (
                          <marker
                            key={kind}
                            id={`${svgId}-${kind}`}
                            markerWidth="7"
                            markerHeight="7"
                            refX="6"
                            refY="3.5"
                            orient="auto-start-reverse"
                          >
                            <path
                              d="M0,0 L7,3.5 L0,7 z"
                              className={`footprint-arrow ${kind}`}
                            />
                          </marker>
                        ),
                      )}
                    </defs>
                    {edges.map((item, index) => {
                      const x = index % 2 === 0 ? 300 : 700;
                      const y = 36 + Math.floor(index / 2) * 72;
                      const incoming =
                        item.to.toLowerCase() === data.address.toLowerCase();
                      return (
                        <g
                          key={item.id}
                          onClick={() => select(item.id)}
                          className="footprint-edge-hit"
                        >
                          <path
                            d={`M ${x} ${y} L ${index % 2 === 0 ? 380 : 620} 180`}
                            className="footprint-hit"
                          />
                          <path
                            d={`M ${x} ${y} L ${index % 2 === 0 ? 380 : 620} 180`}
                            className={`footprint-edge ${item.kind} ${edge?.id === item.id ? "selected" : ""}`}
                            markerEnd={
                              incoming
                                ? `url(#${svgId}-${item.kind})`
                                : undefined
                            }
                            markerStart={
                              !incoming
                                ? `url(#${svgId}-${item.kind})`
                                : undefined
                            }
                          />
                        </g>
                      );
                    })}
                  </svg>
                  <button
                    className="footprint-node footprint-center"
                    style={{ gridColumn: 2, gridRow: 3 }}
                    aria-pressed={!edge}
                    onClick={() => select(null)}
                  >
                    <Fingerprint size={20} />
                    <strong>{tr("조회 지갑")}</strong>
                    <code>{short(data.address, 3)}</code>
                  </button>
                  {edges.map((item, index) => (
                    <button
                      key={item.id}
                      className={`footprint-node ${item.kind}`}
                      style={{
                        gridColumn: index % 2 === 0 ? 1 : 3,
                        gridRow: Math.floor(index / 2) + 1,
                      }}
                      aria-pressed={edge?.id === item.id}
                      aria-label={`${tr(labels[item.kind])}: ${item.from} → ${item.to}`}
                      onClick={() => select(item.id)}
                    >
                      <span>{tr(labels[item.kind])}</span>
                      <code>
                        {short(
                          item.from === data.address.toLowerCase()
                            ? item.to
                            : item.from,
                          4,
                        )}
                      </code>
                    </button>
                  ))}
                </div>
                <aside
                  className="footprint-evidence"
                  aria-label={tr("연결 근거")}
                  aria-live="polite"
                >
                  <span className="section-kicker">{tr("연결 근거")}</span>
                  {edge ? (
                    <>
                      <h3>{tr(labels[edge.kind])}</h3>
                      <dl>
                        <dt>{tr("출발 주소")}</dt>
                        <dd>
                          <AddressLink address={edge.from} />
                        </dd>
                        <dt>{tr("도착 주소")}</dt>
                        <dd>
                          <AddressLink address={edge.to} />
                        </dd>
                      </dl>
                      <p className="fine-print">
                        {tr(
                          "불러온 근거 {0}건 · 같은 유형·방향의 연결을 묶었습니다.",
                          [edge.evidence.length],
                        )}
                      </p>
                      <div className="footprint-evidence-list">
                        {edge.evidence.map((e) => (
                          <div
                            key={e.uid ?? e.tx}
                            className="footprint-evidence-item"
                          >
                            {e.attestation && (
                              <>
                                <p>
                                  {tr(ISSUER_LABELS[e.attestation.issuerClass])}{" "}
                                  ·{" "}
                                  {tr(
                                    e.attestation.status === "active"
                                      ? "활성"
                                      : e.attestation.status === "revoked"
                                        ? "취소됨"
                                        : "만료됨",
                                  )}
                                </p>
                                <p>
                                  isVerified:{" "}
                                  {e.attestation.fields.find(
                                    (f) => f.name === "isVerified",
                                  )?.value ?? "—"}
                                </p>
                                <button
                                  className="text-button"
                                  onClick={() => onSelect(e.attestation!)}
                                >
                                  UID {short(e.uid!, 6)}{" "}
                                  <ExternalLink size={12} />
                                </button>
                              </>
                            )}
                            {e.tx && (
                              <a
                                href={`${NETWORK.explorer}/tx/${e.tx}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                TX {short(e.tx, 6)} <ExternalLink size={12} />
                              </a>
                            )}
                            {e.block !== undefined && (
                              <p>
                                {tr("블록")} {e.block.toLocaleString()}
                              </p>
                            )}
                            {e.timestamp && (
                              <time dateTime={e.timestamp}>
                                {formatDateTime(e.timestamp)}
                              </time>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>{tr("조회 지갑")}</h3>
                      <AddressLink address={data.address} />
                      <p>
                        {data.verifiedBy.length
                          ? tr("DojangScroll 주소 인증 확인 · {0}", [
                              data.verifiedBy.map((i) => tr(i.name)).join(", "),
                            ])
                          : tr(
                              "조회한 등록 발행자 기준 주소 인증이 확인되지 않았습니다.",
                            )}
                      </p>
                      <p className="fine-print">
                        {tr("조회 기준 블록 {0}", [data.block])}
                      </p>
                      <p className="fine-print">
                        {tr(
                          "노드나 연결선을 선택하면 근거를 확인할 수 있습니다.",
                        )}
                      </p>
                      <p className="fine-print">
                        {tr(
                          "EAS 발급 기록과 현재 인증 상태는 다릅니다. 발급자·내용·취소·만료 여부를 상세에서 확인하세요.",
                        )}
                      </p>
                    </>
                  )}
                </aside>
              </div>
              {busy && (
                <p className="fine-print" role="status">
                  {tr(
                    "최근 공개 활동 조회 중… 인증 기록과 다른 화면은 계속 사용할 수 있습니다.",
                  )}
                </p>
              )}
              {!!issueEntries.length && (
                <div className="footprint-errors" role="status">
                  {issueEntries.map(([source, issue]) => (
                    <p key={source}>
                      {tr(
                        source === "transactions"
                          ? "컨트랙트 호출"
                          : "직접 토큰 전송",
                      )}
                      :{" "}
                      {tr(
                        issue === "rate-limit"
                          ? "조회 한도에 도달했습니다. 잠시 후 다시 시도하세요."
                          : "활동을 불러오지 못했습니다. 확인된 다른 근거만 표시합니다.",
                      )}
                    </p>
                  ))}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setActivity(null);
                      setAttempt((v) => v + 1);
                    }}
                  >
                    {tr("다시 조회")}
                  </button>
                </div>
              )}
              {activity && !busy && !edges.length && (
                <p className="fine-print">
                  {tr(
                    "이번 조회 범위에서 표시할 직접 연결을 찾지 못했습니다. 활동이 없다는 뜻은 아닙니다.",
                  )}
                </p>
              )}
              <p className="fine-print">
                {tr(
                  "최근 거래·토큰 전송 각 1페이지(최대 50건), 직접 연결 최대 10개만 표시합니다. 전체 활동 이력이 아닙니다.",
                )}
                {(limited || data.next) && (
                  <> {tr("추가 기록은 이 그래프에 포함되지 않았습니다.")}</>
                )}
              </p>
              <p className="fine-print">
                {tr(
                  "주소 인증은 이미 불러온 EAS 기록만 사용합니다. 현재 인증이 확인되어도 해당 발급 기록이 이 범위에 없을 수 있습니다.",
                )}
              </p>
            </>
          ) : (
            <div className="footprint-comparison">
              <p className="footprint-intro">
                {tr(
                  "아래 A·B는 설명용 역할이며, 조회한 주소나 발견된 지갑이 아닙니다.",
                )}
              </p>
              <div className="footprint-architecture">
                <div>
                  <span>B</span>
                  <strong>{tr("인증 지갑")}</strong>
                  <p>{tr("기초 자격 보유")}</p>
                </div>
                <ArrowRight aria-hidden="true" />
                <div className="footprint-proof">
                  <Fingerprint size={24} />
                  <strong>{tr("ZK 자격 증명")}</strong>
                  <p>{tr("의도한 행동 또는 검증 지갑에 바인딩")}</p>
                </div>
                <ArrowRight aria-hidden="true" />
                <div>
                  <span>A</span>
                  <strong>{tr("별도 활동 지갑")}</strong>
                  <p>{tr("dApp의 자격 정책 충족")}</p>
                </div>
              </div>
              <p>
                {tr(
                  "앱은 증명을 통해 지갑 B를 공개받지 않고 자격을 검증할 수 있습니다. 이를 지원하는 회로와 앱 통합이 필요합니다.",
                )}
              </p>
              <p>
                {tr(
                  "ZKProofport는 인증 지갑과 활동 지갑을 분리해 자격을 증명할 수 있도록 합니다. 거래 내역 자체가 비공개로 바뀌는 것은 아닙니다.",
                )}
              </p>
              <p className="fine-print">
                {tr(
                  "기존 거래는 그대로 남습니다. 공개 입력, nullifier, 지갑 간 전송 등 외부 정보로 활동이 연관될 수 있습니다.",
                )}
              </p>
            </div>
          )}
          <div className="footprint-footer">
            <div>
              <p className="fine-print">
                {tr(
                  "이 화면은 공개된 온체인 기록의 직접적인 연결만 보여줍니다. 주소 간 거래가 동일인 소유를 의미하지는 않습니다.",
                )}
              </p>
              <p className="fine-print">
                {tr(
                  "Proof Studio는 Playground·EAS KYC Mock 실습입니다. 공식 Upbit KYC의 프로덕션 검증이나 위 지갑 분리 구조의 구현을 의미하지 않습니다.",
                )}
              </p>
            </div>
            <button className="secondary-button" onClick={onStudio}>
              {tr("비공개 자격 증명 알아보기")}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
function AddressLink({ address }: { address: string }) {
  return (
    <a
      className="footprint-address"
      href={`${NETWORK.explorer}/address/${address}`}
      target="_blank"
      rel="noreferrer"
    >
      {address}
    </a>
  );
}
