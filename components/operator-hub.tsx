import { issuerMetadata } from "@/lib/issuer-metadata";
import { lazy, Suspense, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Search,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { CONTRACTS, NETWORK, short, type ScanData } from "@/lib/giwa";
import { tr } from "@/lib/i18n";
import { Badge, CopyButton } from "./scan-ui";
const Workspace = lazy(() => import("./workspace"));
type Role = "issuer" | "admin" | "console";
const roles = [
  { id: "issuer", label: "발행자", icon: ShieldCheck },
  { id: "admin", label: "관리자", icon: KeyRound },
  { id: "console", label: "Contract Console", icon: Terminal },
] as const;

export default function OperatorHub({
  data,
  error,
  onWallet,
  initialManage = false,
}: {
  data: ScanData | null;
  error: string;
  onWallet: (address: string) => void;
  initialManage?: boolean;
}) {
  const [role, setRole] = useState<Role>("issuer");
  const [manage, setManage] = useState(initialManage);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const managers =
    data?.governance.roles.filter((r) => r.active === true) ?? [];
  const issuerRows = (data?.issuers ?? []).filter((i) =>
    `${i.name} ${i.address} ${i.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const adminRows = managers.filter((r) =>
    `${r.contract} ${r.address} ${r.role}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const total = role === "issuer" ? issuerRows.length : adminRows.length;
  const pages = Math.max(1, Math.ceil(total / 5));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 5;
  return (
    <section className="operator-hub">
      <div
        className="operator-tabs"
        role="tablist"
        aria-label={tr("운영 역할")}
      >
        {roles.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`operator-tab-${id}`}
            role="tab"
            aria-selected={role === id}
            tabIndex={role === id ? 0 : -1}
            onKeyDown={(event) => {
              const index = roles.findIndex((item) => item.id === role);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % roles.length
                  : event.key === "ArrowLeft"
                    ? (index + roles.length - 1) % roles.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? roles.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setRole(roles[next].id);
              setQuery("");
              setPage(1);
              document
                .getElementById(`operator-tab-${roles[next].id}`)
                ?.focus();
            }}
            aria-controls="operator-content"
            onClick={() => {
              setRole(id);
              setQuery("");
              setPage(1);
            }}
          >
            <Icon size={18} />
            <span>{tr(label)}</span>
            {id !== "console" && (
              <small>
                {data
                  ? id === "issuer"
                    ? data.issuers.length
                    : managers.length
                  : "—"}
              </small>
            )}
          </button>
        ))}
      </div>
      <div
        id="operator-content"
        role="tabpanel"
        aria-labelledby={`operator-tab-${role}`}
      >
        {role !== "console" && (
          <div className="operator-toolbar">
            <div>
              <h2>
                {tr(role === "issuer" ? "현재 등록 발행자" : "관리 권한")}
              </h2>
              <p>
                {tr(
                  role === "issuer"
                    ? "등록 주소를 확인하거나, 권한이 있는 지갑으로 도장을 발급하세요."
                    : "현재 역할을 확인하고, 권한이 있는 지갑으로 등록과 설정을 관리하세요.",
                )}
              </p>
            </div>
            <div className="operator-mode" aria-label={tr("화면 선택")}>
              <button aria-pressed={!manage} onClick={() => setManage(false)}>
                {tr("목록")}
              </button>
              <button aria-pressed={manage} onClick={() => setManage(true)}>
                {tr(role === "issuer" ? "발급·취소" : "권한·등록 관리")}
              </button>
            </div>
          </div>
        )}
        {manage || role === "console" ? (
          <Suspense
            fallback={<p className="operator-empty">{tr("화면 준비 중")}</p>}
          >
            <Workspace key={role} data={data} role={role} />
          </Suspense>
        ) : (
          <>
            <div className="operator-search">
              <Search size={17} />
              <input
                aria-label={tr("이름 또는 주소로 찾기")}
                placeholder={tr("이름 또는 주소로 찾기")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <span>{total}</span>
            </div>
            <div className="operator-directory">
              {!data ? (
                <p className="operator-empty" role="status">
                  {tr(error || "온체인 등록 정보를 불러오는 중입니다.")}
                </p>
              ) : !total ? (
                <p className="operator-empty">
                  {tr("일치하는 주소가 없습니다.")}
                </p>
              ) : role === "issuer" ? (
                issuerRows.slice(start, start + 5).map((issuer, index) => (
                  <article className="operator-row" key={issuer.id}>
                    <span className="operator-number">
                      {String(start + index + 1).padStart(2, "0")}
                    </span>
                    <div className="operator-identity">
                      <strong>{tr(issuer.name)}</strong>
                      <div className="address-line">
                        <code title={issuer.address}>
                          {short(issuer.address, 8)}
                        </code>
                        <CopyButton value={issuer.address} />
                      </div>
                    </div>
                    <Badge variant="success">{tr("Dojang 등록")}</Badge>
                    <div className="operator-row-actions">
                      <button
                        className="text-button"
                        onClick={() => onWallet(issuer.address)}
                      >
                        {tr("주소 기록")}
                        <ArrowRight size={14} />
                      </button>
                      <a
                        href={`${NETWORK.explorer}/address/${issuer.address}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={tr("탐색기")}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                    <details className="operator-row-detail">
                      <summary>{tr("등록 정보")}</summary>
                      <code>{issuer.id}</code>
                      {issuerMetadata(issuer.id) && (
                        <p>
                          <a
                            href={issuerMetadata(issuer.id)!.source}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {tr("발행자 이름 출처: GIWA 공식 문서")} ↗
                          </a>
                        </p>
                      )}
                      {issuer.tx && (
                        <a
                          href={`${NETWORK.explorer}/tx/${issuer.tx}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {tr("등록 이벤트")} ↗
                        </a>
                      )}
                    </details>
                  </article>
                ))
              ) : (
                adminRows.slice(start, start + 5).map((r) => (
                  <article
                    className="operator-row"
                    key={r.contract + r.roleId + r.address}
                  >
                    <span className="operator-number">
                      <KeyRound size={18} />
                    </span>
                    <div className="operator-identity">
                      <strong>{r.contract}</strong>
                      <div className="address-line">
                        <code title={r.address}>{short(r.address, 8)}</code>
                        <CopyButton value={r.address} />
                      </div>
                    </div>
                    <Badge variant={r.role === "admin" ? "blue" : "purple"}>
                      {tr(r.role === "admin" ? "등록 관리" : "업그레이드")}
                    </Badge>
                    <div className="operator-row-actions">
                      <a
                        href={`${NETWORK.explorer}/address/${r.address}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {tr("탐색기")}
                        <ExternalLink size={15} />
                      </a>
                    </div>
                    <details className="operator-row-detail">
                      <summary>{tr("역할 정보")}</summary>
                      <p>
                        {tr(
                          r.role === "admin"
                            ? "스키마 / 발행자 목록을 바꿀 수 있는 권한"
                            : "컨트랙트 구현을 교체할 수 있는 권한",
                        )}
                      </p>
                      <code>{r.roleId}</code>
                    </details>
                  </article>
                ))
              )}
            </div>
            <div className="operator-pagination">
              <small>
                {tr("조회 블록")} {data?.block.toLocaleString() ?? "—"}
              </small>
              <div>
                <button
                  className="icon-button"
                  disabled={currentPage === 1}
                  aria-label={tr("이전 페이지")}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span>
                  {currentPage} / {pages}
                </span>
                <button
                  className="icon-button"
                  disabled={currentPage === pages}
                  aria-label={tr("다음 페이지")}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <details className="operator-notes">
              <summary>{tr("조회 기준과 컨트랙트")}</summary>
              <p>
                {tr(
                  role === "issuer"
                    ? "현재 AttesterBook 등록을 기준으로 표시합니다. 발행자 등록과 resolver의 발급 허용은 별개입니다."
                    : "Book의 역할 이벤트에서 주소를 찾고 hasRole로 현재 권한을 확인합니다. Resolver와 발행자 계약의 하위 권한은 포함하지 않으며, 발견 범위에 따라 목록이 불완전할 수 있습니다.",
                )}
              </p>
              <div className="operator-contracts">
                {Object.entries(CONTRACTS).map(([name, address]) => (
                  <a
                    key={name}
                    href={`${NETWORK.explorer}/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {name}
                    <ExternalLink size={13} />
                  </a>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
